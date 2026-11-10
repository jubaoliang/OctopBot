/**
 * Error model per docs/api-contract.md: every error response carries
 * `{ "error": { "code", "message", "details?" } }`.
 */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class OctopApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OctopApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Auth failures that mean "stored token is dead — re-login". */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.code === 'AUTH_FAILED' || this.code === 'TOKEN_EXPIRED';
  }

  get isSetupRequired(): boolean {
    return this.code === 'SETUP_REQUIRED' || this.status === 503;
  }
}

/** Parses an error response body (already JSON-parsed) into an OctopApiError. */
export function parseApiError(status: number, body: unknown): OctopApiError {
  if (isEnvelope(body)) {
    return new OctopApiError(status, body.error.code, body.error.message, body.error.details);
  }
  // Non-conforming body (proxy error, HTML from a wrong URL, …).
  const message =
    typeof body === 'object' && body !== null && 'detail' in body
      ? String(body.detail)
      : `HTTP ${status}`;
  return new OctopApiError(status, 'HTTP_ERROR', message);
}

function isEnvelope(body: unknown): body is ApiErrorEnvelope {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const error = (body as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  return typeof code === 'string' && typeof message === 'string';
}
