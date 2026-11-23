import { serializeUserTurn } from '../api/attachments';
import type { ClientFrame, ServerFrame, UserTurnFrame } from '../api/types';
import { logConnection, type ConnectionSocket } from '../connection-log';

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
  /** How long a ping may go unanswered before the socket is treated as dead. */
  pongTimeoutMs?: number;
  /** Retries for a socket that has never opened (blip at connect, server restarting). */
  initialAttempts?: number;
  /** Label used in the connection diagnostics log; defaults to the chat socket. */
  name?: ConnectionSocket;
}

const DEFAULT_RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
const AUTH_CLOSE_CODE = 4001;
// 20s/8s keeps detection well inside any reverse proxy's idle limit (60s is
// the common default) while noticing a dead socket within ~28s.
const HEARTBEAT_MS = 20_000;
const PONG_TIMEOUT_MS = 8_000;
const INITIAL_ATTEMPTS = 6;

/**
 * Chat WebSocket with application-level heartbeat and backoff reconnect.
 * Pure orchestration — the platform layer supplies the WebSocket itself.
 * Disconnecting does NOT cancel a turn server-side; the UI sends `cancel`
 * explicitly when the user asks for a stop.
 *
 * Robustness contract: a socket that never opened retries in the background
 * (the caller's connect() still rejects so the UI is not blocked), a missed
 * pong is detected within `pongTimeoutMs` instead of the next tick, and
 * `resume()` probes or reconnects immediately when the app returns to the
 * foreground rather than waiting out a backoff timer.
 */
export class ChatSocket {
  private readonly options: Required<
    Pick<
      ChatSocketOptions,
      'reconnectDelaysMs' | 'heartbeatMs' | 'pongTimeoutMs' | 'initialAttempts' | 'name'
    >
  > &
    ChatSocketOptions;
  private socket: WebSocket | null = null;
  private attempt = 0;
  private initialAttempts = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set after a ping; cleared on pong. True at the next tick ⇒ dead socket. */
  private awaitingPong = false;
  private state: ChatConnectionStatus = 'idle';
  private subscribedThread: string | null = null;
  private everOpened = false;
  private connectPromise: Promise<void> | null = null;
  /** Bumped on close so a late open after teardown cannot stick. */
  private connectGeneration = 0;

  constructor(options: ChatSocketOptions) {
    this.options = {
      reconnectDelaysMs: DEFAULT_RECONNECT_DELAYS,
      heartbeatMs: HEARTBEAT_MS,
      pongTimeoutMs: PONG_TIMEOUT_MS,
      initialAttempts: INITIAL_ATTEMPTS,
      name: 'chat',
      ...options,
    };
  }

  /**
   * Resolves true once the socket is open, false when `timeoutMs` elapses or
   * the socket is in a terminal state. Lets a send ride out a brief blip
   * instead of failing on the first dropped frame.
   */
  waitUntilOpen(timeoutMs: number): Promise<boolean> {
    if (this.state === 'open') {
      return Promise.resolve(true);
    }
    if (this.state !== 'connecting' && this.state !== 'reconnecting') {
      return Promise.resolve(false);
    }
    return new Promise(resolve => {
      const started = Date.now();
      const poll = () => {
        if (this.state === 'open') {
          resolve(true);
          return;
        }
        if (this.state !== 'connecting' && this.state !== 'reconnecting') {
          resolve(false);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(poll, 200);
      };
      poll();
    });
  }

  get status(): ChatConnectionStatus {
    return this.state;
  }

  /**
   * Opens the socket. The promise settles on open, or rejects if the
   * handshake is rejected / the socket dies before opening. Concurrent
   * callers share one attempt; call again after a failure.
   */
  connect(): Promise<void> {
    if (this.state === 'open') {
      return Promise.resolve();
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.connectPromise = this.openSocket();
    return this.connectPromise;
  }

  private clearConnectPromiseIfCurrent(generation: number): void {
    // Never clobber a newer connect()'s shared promise from a stale attempt.
    if (generation === this.connectGeneration) {
      this.connectPromise = null;
    }
  }

  private async openSocket(): Promise<void> {
    const generation = this.connectGeneration;
    this.setStatus('connecting');
    const token = await this.options.tokenFactory();
    if (generation !== this.connectGeneration) {
      this.clearConnectPromiseIfCurrent(generation);
      throw new Error('connect aborted');
    }
    if (!token) {
      this.clearConnectPromiseIfCurrent(generation);
      this.setStatus('unauthorized');
      throw new Error('no access token');
    }
    const url = this.wsUrl(this.options.baseUrl, this.options.path, token);
    const factory = this.options.socketFactory ?? ((u: string) => new WebSocket(u));
    const socket = factory(url);
    if (generation !== this.connectGeneration) {
      this.clearConnectPromiseIfCurrent(generation);
      try {
        socket.close(1000, 'connect aborted');
      } catch {
        // ignore
      }
      throw new Error('connect aborted');
    }
    this.socket = socket;

    let settleOpen: () => void = () => undefined;
    let settleFail: (reason: Error) => void = () => undefined;
    const handshake = new Promise<void>((resolve, reject) => {
      settleOpen = resolve;
      settleFail = reject;
    });

    const isCurrent = () => generation === this.connectGeneration && this.socket === socket;

    socket.addEventListener('open', () => {
      if (!isCurrent()) {
        try {
          socket.close(1000, 'connect aborted');
        } catch {
          // ignore
        }
        settleFail(new Error('connect aborted'));
        return;
      }
      this.everOpened = true;
      this.attempt = 0;
      this.awaitingPong = false;
      this.setStatus('open');
      this.startHeartbeat();
      if (this.subscribedThread) {
        this.rawSend({ type: 'subscribe', thread_id: this.subscribedThread });
      }
      settleOpen();
    });

    socket.addEventListener('message', event => {
      if (!isCurrent()) {
        return;
      }
      const frame = parseFrame(event.data);
      if (frame) {
        if (frame.type === 'pong') {
          // The heartbeat answer — the connection is alive.
          this.awaitingPong = false;
          if (this.pongTimer !== null) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
          }
        }
        this.options.onFrame(frame);
      }
    });

    socket.addEventListener('close', event => {
      if (!isCurrent() && generation !== this.connectGeneration) {
        // Stale socket from an aborted generation — ignore entirely.
        settleFail(new Error('connect aborted'));
        return;
      }
      this.stopHeartbeat();
      if (this.socket === socket) {
        this.socket = null;
      }
      this.clearConnectPromiseIfCurrent(generation);
      if (this.state === 'closed' || generation !== this.connectGeneration) {
        return;
      }
      if (event.code === AUTH_CLOSE_CODE) {
        // The token was rejected — no retry can succeed before a new sign-in.
        this.setStatus('unauthorized', 'token rejected');
        settleFail(new Error('token rejected'));
        return;
      }
      // Agent-level rejections (4003 forbidden, 4404 not found) never recover
      // on retry — surface them as terminal instead of reconnect-looping.
      if (event.code === 4003 || event.code === 4404) {
        const reason = `server closed the connection: ${event.code}`;
        this.setStatus('closed', reason);
        settleFail(new Error(reason));
        return;
      }
      if (!this.everOpened && this.initialAttempts >= this.options.initialAttempts) {
        // Handshake rejected and the background retries ran out (HTTP
        // rejections surface as a generic 1006): stop hammering the server.
        this.setStatus('closed', 'connection refused');
        settleFail(new Error('connection refused'));
        return;
      }
      // A refused first handshake is usually transient (radio coming up,
      // network switch, server restarting): reject the caller so the UI is
      // not blocked, but keep retrying in the background so the thread
      // recovers on its own.
      settleFail(new Error('connection refused'));
      this.scheduleReconnect(closeDetail(event));
    });

    socket.addEventListener('error', () => {
      // The close event follows with the actionable code; nothing to do here.
    });

    await handshake;
  }

  /** Sends a user turn; returns false when the socket is not open. */
  sendUserTurn(frame: Omit<UserTurnFrame, 'type'>): boolean {
    // Attachments must travel as `messages[].content` blocks — the server
    // drops a top-level `attachments` field on ChatTurnBody.
    const body: UserTurnFrame = { type: 'user_turn', ...serializeUserTurn(frame) };
    return this.rawSend(body);
  }

  /** (Re)attaches this connection to a thread — used on reconnect and screen switches. */
  subscribe(threadId: string): boolean {
    this.subscribedThread = threadId;
    return this.rawSend({ type: 'subscribe', thread_id: threadId });
  }

  cancel(threadId: string): boolean {
    return this.rawSend({ type: 'cancel', thread_id: threadId });
  }

  /** Publishes this device's tool set for the connected agent session. */
  sendDeviceToolsRegister(
    tools: {
      name: string;
      description: string;
      input_schema: Record<string, unknown>;
      requires_confirmation: boolean;
    }[],
  ): boolean {
    return this.rawSend({ type: 'device_tools.register', tools });
  }

  /** Answers a `device_tool_call` with the on-device execution result. */
  sendDeviceToolResult(callId: string, result: { output?: unknown; error?: string }): boolean {
    return this.rawSend({ type: 'device_tool_result', call_id: callId, ...result });
  }

  ping(): boolean {
    return this.rawSend({ type: 'ping' });
  }

  /** Sends any client frame verbatim — the session socket multiplexes several
   *  concerns (pushes, device presence) over one connection by frame type. */
  sendFrame(frame: ClientFrame): boolean {
    return this.rawSend(frame);
  }

  close(): void {
    this.connectGeneration += 1;
    this.connectPromise = null;
    this.setStatus('closed');
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close(1000, 'client closed');
    this.socket = null;
    // A later connect() on this instance is a fresh session: a refused
    // handshake must get the full initial-retry budget again.
    this.everOpened = false;
    this.initialAttempts = 0;
    this.attempt = 0;
  }

  /**
   * App returned to the foreground: probe an open socket right away and
   * reconnect immediately instead of waiting out a pending backoff. Timers
   * are throttled in the background, so without this a socket killed by
   * the OS would only be noticed on the next heartbeat tick.
   */
  resume(): void {
    if (this.state === 'open') {
      this.awaitingPong = false;
      if (this.ping()) {
        this.awaitingPong = true;
        this.armPongTimeout();
      }
      return;
    }
    if (this.state !== 'reconnecting' && this.state !== 'connecting') {
      return;
    }
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    void this.connect().catch(() => undefined);
  }

  private rawSend(frame: ClientFrame): boolean {
    if (this.state !== 'open' || this.socket === null) {
      return false;
    }
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  private scheduleReconnect(reason?: string): void {
    const delay =
      this.options.reconnectDelaysMs[
        Math.min(this.attempt, this.options.reconnectDelaysMs.length - 1)
      ];
    this.attempt += 1;
    if (!this.everOpened) {
      this.initialAttempts += 1;
    }
    const detail = reason
      ? `attempt ${this.attempt} in ${delay}ms · ${reason}`
      : `attempt ${this.attempt} in ${delay}ms`;
    this.setStatus('reconnecting', detail);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // Internal attempt: no caller holds the promise, and terminal
      // outcomes already surface through onStatus — swallow the rejection
      // (a client close() racing an in-flight attempt aborts it).
      void this.connect().catch(() => undefined);
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.awaitingPong = false;
    this.heartbeat = setInterval(() => {
      if (this.awaitingPong) {
        // The previous ping was never answered — a half-open socket keeps
        // accepting writes with no error while the server side is gone.
        // Force it closed so the close path schedules a reconnect.
        try {
          this.socket?.close();
        } catch {
          // ignore
        }
        return;
      }
      if (this.ping()) {
        this.awaitingPong = true;
        this.armPongTimeout();
      }
    }, this.options.heartbeatMs);
  }

  /**
   * Bound the wait for a pong independently of the heartbeat interval:
   * otherwise a socket that dies right after a tick is only noticed at the
   * next one (a full interval later).
   */
  private armPongTimeout(): void {
    if (this.pongTimer !== null) {
      clearTimeout(this.pongTimer);
    }
    this.pongTimer = setTimeout(() => {
      this.pongTimer = null;
      if (!this.awaitingPong) {
        return;
      }
      try {
        this.socket?.close();
      } catch {
        // ignore
      }
    }, this.options.pongTimeoutMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    if (this.pongTimer !== null) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private setStatus(status: ChatConnectionStatus, detail?: string): void {
    this.state = status;
    logConnection({ socket: this.options.name, status, detail });
    this.options.onStatus(status, detail);
  }

  private wsUrl(baseUrl: string, path: string, token: string): string {
    const http = new URL(baseUrl);
    const scheme = http.protocol === 'http:' ? 'ws' : 'wss';
    // Keep a deployment sub-path (https://corp.example.com/octop/): the
    // socket lives under the same prefix as the REST API.
    const prefix = http.pathname.replace(/\/+$/, '');
    return `${scheme}://${http.host}${prefix}${path}?token=${encodeURIComponent(token)}`;
  }
}

/**
 * Close code and reason for diagnostics when the platform supplies them
 * (an abnormal drop surfaces as 1006 with no reason; proxies that send a
 * reason make field reports far more actionable).
 */
function closeDetail(event: { code?: number; reason?: string }): string | undefined {
  const code = typeof event.code === 'number' ? event.code : undefined;
  const reason = typeof event.reason === 'string' ? event.reason.trim() : '';
  if (code === undefined && !reason) {
    return undefined;
  }
  return reason ? `close ${code ?? ''} (${reason})` : `close ${code}`;
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
