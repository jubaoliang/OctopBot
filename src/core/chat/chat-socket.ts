import type { ClientFrame, ServerFrame, UserTurnFrame } from '../api/types';

export type ChatConnectionStatus =
  'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'unauthorized';

export interface ChatSocketOptions {
  /** Full chat WS path on the server, e.g. `/api/agents/{id}/chat/ws`. */
  path: string;
  baseUrl: string;
  tokenFactory: () => Promise<string | null>;
  onFrame: (frame: ServerFrame) => void;
  onStatus: (status: ChatConnectionStatus, detail?: string) => void;
  /** Injectable for tests; defaults to the runtime global WebSocket. */
  socketFactory?: (url: string) => WebSocket;
  reconnectDelaysMs?: number[];
  heartbeatMs?: number;
}

const DEFAULT_RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
const AUTH_CLOSE_CODE = 4001;
const HEARTBEAT_MS = 30_000;

/**
 * Chat WebSocket with application-level heartbeat and backoff reconnect.
 * Pure orchestration — the platform layer supplies the WebSocket itself.
 * Disconnecting does NOT cancel a turn server-side; the UI sends `cancel`
 * explicitly when the user asks for a stop.
 */
export class ChatSocket {
  private readonly options: Required<Pick<ChatSocketOptions, 'reconnectDelaysMs' | 'heartbeatMs'>> &
    ChatSocketOptions;
  private socket: WebSocket | null = null;
  private attempt = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private state: ChatConnectionStatus = 'idle';
  private subscribedThread: string | null = null;

  constructor(options: ChatSocketOptions) {
    this.options = {
      reconnectDelaysMs: DEFAULT_RECONNECT_DELAYS,
      heartbeatMs: HEARTBEAT_MS,
      ...options,
    };
  }

  get status(): ChatConnectionStatus {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state === 'open' || this.state === 'connecting') {
      return;
    }
    this.setStatus('connecting');
    const token = await this.options.tokenFactory();
    if (!token) {
      this.setStatus('unauthorized');
      return;
    }
    const url = this.wsUrl(this.options.baseUrl, this.options.path, token);
    const factory = this.options.socketFactory ?? ((u: string) => new WebSocket(u));
    const socket = factory(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.attempt = 0;
      this.setStatus('open');
      this.startHeartbeat();
      if (this.subscribedThread) {
        this.rawSend({ type: 'subscribe', thread_id: this.subscribedThread });
      }
    });

    socket.addEventListener('message', event => {
      const frame = parseFrame(event.data);
      if (frame) {
        this.options.onFrame(frame);
      }
    });

    socket.addEventListener('close', event => {
      this.stopHeartbeat();
      this.socket = null;
      if (this.state === 'closed') {
        return;
      }
      if (event.code === AUTH_CLOSE_CODE) {
        this.setStatus('unauthorized', 'token rejected');
        return;
      }
      // Agent-level rejections (4003 forbidden, 4404 not found) never recover
      // on retry — surface them as terminal instead of reconnect-looping.
      if (event.code === 4003 || event.code === 4404) {
        this.setStatus('closed', `server closed the connection: ${event.code}`);
        return;
      }
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      // The close event follows with the actionable code; nothing to do here.
    });
  }

  /** Sends a user turn; returns false when the socket is not open. */
  sendUserTurn(frame: Omit<UserTurnFrame, 'type'>): boolean {
    return this.rawSend({ type: 'user_turn', ...frame });
  }

  /** (Re)attaches this connection to a thread — used on reconnect and screen switches. */
  subscribe(threadId: string): boolean {
    this.subscribedThread = threadId;
    return this.rawSend({ type: 'subscribe', thread_id: threadId });
  }

  cancel(threadId: string): boolean {
    return this.rawSend({ type: 'cancel', thread_id: threadId });
  }

  ping(): boolean {
    return this.rawSend({ type: 'ping' });
  }

  close(): void {
    this.setStatus('closed');
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close(1000, 'client closed');
    this.socket = null;
  }

  private rawSend(frame: ClientFrame): boolean {
    if (this.state !== 'open' || this.socket === null) {
      return false;
    }
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  private scheduleReconnect(): void {
    const delay =
      this.options.reconnectDelaysMs[
        Math.min(this.attempt, this.options.reconnectDelaysMs.length - 1)
      ];
    this.attempt += 1;
    this.setStatus('reconnecting', `attempt ${this.attempt} in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      this.ping();
    }, this.options.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private setStatus(status: ChatConnectionStatus, detail?: string): void {
    this.state = status;
    this.options.onStatus(status, detail);
  }

  private wsUrl(baseUrl: string, path: string, token: string): string {
    const http = new URL(baseUrl);
    const scheme = http.protocol === 'http:' ? 'ws' : 'wss';
    return `${scheme}://${http.host}${path}?token=${encodeURIComponent(token)}`;
  }
}

/** Parses an inbound frame; unknown frame types pass through (forward-compat), garbage drops. */
export function parseFrame(raw: unknown): ServerFrame | null {
  if (typeof raw !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
      return parsed as ServerFrame;
    }
    return null;
  } catch {
    return null;
  }
}
