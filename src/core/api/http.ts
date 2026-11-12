import { OctopApiError, parseApiError } from './errors';

export interface HttpClientOptions {
  baseUrl: string;
  /** Returns the current access token (injected from secure storage). */
  getToken: () => Promise<string | null>;
  /** Called when the server slides a fresh token via X-Octop-Access-Token. */
  onTokenRenewed: (token: string) => Promise<void>;
  /** Called on 401/TOKEN_EXPIRED — the app clears session state and shows login. */
  onUnauthorized: () => void;
  timeoutMs?: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Auth-exempt calls (health check, login) skip the Authorization header. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * JSON client for the Octop API. Pure TS on fetch — the platform layer owns
 * the transport (React Native provides fetch and AbortController).
 */
export class HttpClient {
  private readonly options: Required<Pick<HttpClientOptions, 'timeoutMs'>> & HttpClientOptions;

  constructor(options: HttpClientOptions) {
    this.options = { timeoutMs: DEFAULT_TIMEOUT_MS, ...options };
  }

  get<T>(path: string, options: { anonymous?: boolean; signal?: AbortSignal } = {}): Promise<T> {
    return this.request<T>(path, { method: 'GET', ...options });
  }

  post<T>(path: string, body?: unknown, options: { anonymous?: boolean } = {}): Promise<T> {
    return this.request<T>(path, { method: 'POST', body, ...options });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  /**
   * Multipart upload. Do not set Content-Type — fetch supplies the boundary.
   * `body` is typically a FormData with a RN file part `{ uri, name, type }`.
   * Default timeout is longer than JSON calls (audio STT can exceed 15s).
   */
  postForm<T>(
    path: string,
    body: FormData,
    options: { anonymous?: boolean; signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<T> {
    return this.requestForm<T>(path, {
      method: 'POST',
      body,
      anonymous: options.anonymous,
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? 60_000,
    });
  }

  /**
   * Authenticated fetch that returns the raw Response (for SSE / streaming).
   * Callers own body consumption; auth failure still clears the session.
   * No default timeout — SSE resumes can run longer than JSON calls.
   */
  async requestRaw(
    path: string,
    options: {
      method?: 'GET' | 'POST';
      body?: unknown;
      anonymous?: boolean;
      signal?: AbortSignal;
    } = {},
  ): Promise<Response> {
    const { method = 'GET', body, anonymous = false, signal } = options;
    const headers: Record<string, string> = { Accept: 'text/event-stream, application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (!anonymous) {
      const token = await this.options.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      if (signal?.aborted) {
        throw new OctopApiError(0, 'ABORTED', 'request aborted');
      }
      throw new OctopApiError(0, 'NETWORK_ERROR', describeNetworkError(cause));
    }
    const renewed = response.headers.get('X-Octop-Access-Token');
    if (renewed && !anonymous) {
      await this.options.onTokenRenewed(renewed);
    }
    if (!response.ok) {
      const text = await response.text();
      const parsed: unknown = text ? safeJsonParse(text) : null;
      const error = parseApiError(response.status, parsed);
      if (error.isAuthFailure) {
        this.options.onUnauthorized();
      }
      throw error;
    }
    return response;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, anonymous = false, signal } = options;
    return this.sendJson<T>(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      contentType: body === undefined ? undefined : 'application/json',
      anonymous,
      signal,
    });
  }

  private async requestForm<T>(
    path: string,
    options: {
      method: 'POST';
      body: FormData;
      anonymous?: boolean;
      signal?: AbortSignal;
      timeoutMs?: number;
    },
  ): Promise<T> {
    return this.sendJson<T>(path, {
      method: options.method,
      body: options.body,
      anonymous: options.anonymous ?? false,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });
  }

  private async sendJson<T>(
    path: string,
    options: {
      method: string;
      body?: string | FormData;
      contentType?: string;
      anonymous: boolean;
      signal?: AbortSignal;
      timeoutMs?: number;
    },
  ): Promise<T> {
    const { method, body, contentType, anonymous, signal, timeoutMs } = options;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    if (!anonymous) {
      const token = await this.options.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(),
      timeoutMs ?? this.options.timeoutMs,
    );
    const onExternalAbort = () => timeoutController.abort();
    signal?.addEventListener('abort', onExternalAbort);

    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: timeoutController.signal,
      });
    } catch (cause) {
      if (signal?.aborted) {
        throw new OctopApiError(0, 'ABORTED', 'request aborted');
      }
      throw new OctopApiError(0, 'NETWORK_ERROR', describeNetworkError(cause));
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onExternalAbort);
    }

    // Sliding renewal: any authenticated response may carry a fresh token.
    const renewed = response.headers.get('X-Octop-Access-Token');
    if (renewed && !anonymous) {
      await this.options.onTokenRenewed(renewed);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const parsed: unknown = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      const error = parseApiError(response.status, parsed);
      if (error.isAuthFailure) {
        this.options.onUnauthorized();
      }
      throw error;
    }
    return parsed as T;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function describeNetworkError(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return 'request timed out';
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return 'network request failed';
}
