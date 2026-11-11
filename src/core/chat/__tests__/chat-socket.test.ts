import { ChatSocket, parseFrame } from '../chat-socket';
import type { ChatConnectionStatus } from '../chat-socket';

class FakeSocket {
  static created: FakeSocket[] = [];
  sent: string[] = [];
  private listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(public url: string) {
    FakeSocket.created.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(): void {
    // Not exercised by the tests.
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.emit('close', closeEvent(1000));
  }

  // --- test helpers -------------------------------------------------------
  open(): void {
    this.emit('open', new Event('open'));
  }

  serverMessage(frame: object): void {
    this.emit('message', new MessageEvent('message', { data: JSON.stringify(frame) }));
  }

  serverClose(code: number): void {
    this.emit('close', closeEvent(code));
  }

  private emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function closeEvent(code: number): CloseEvent {
  const event = new Event('close');
  Object.defineProperty(event, 'code', { value: code });
  return event as CloseEvent;
}

function makeSocket() {
  const statuses: { status: ChatConnectionStatus; detail?: string }[] = [];
  const frames: unknown[] = [];
  const socket = new ChatSocket({
    baseUrl: 'https://octop.example.com',
    path: '/api/agents/a1/chat/ws',
    tokenFactory: () => Promise.resolve('jwt-token'),
    onFrame: frame => frames.push(frame),
    onStatus: (status, detail) => statuses.push({ status, detail }),
    socketFactory: url => new FakeSocket(url) as unknown as WebSocket,
    reconnectDelaysMs: [10, 20],
  });
  return { socket, statuses, frames };
}

describe('parseFrame', () => {
  it('passes through typed objects', () => {
    expect(parseFrame('{"type":"token","content":"hi"}')).toMatchObject({
      type: 'token',
      content: 'hi',
    });
  });

  it('keeps unknown frame types for forward compatibility', () => {
    expect(parseFrame('{"type":"future.shiny","x":1}')).toMatchObject({ type: 'future.shiny' });
  });

  it('drops garbage, arrays, and non-strings', () => {
    expect(parseFrame('not json')).toBeNull();
    expect(parseFrame('[1,2]')).toBeNull();
    expect(parseFrame({ type: 'token' })).toBeNull();
  });
});

describe('ChatSocket', () => {
  beforeEach(() => {
    FakeSocket.created = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds a wss URL with the token and reaches open', async () => {
    const { socket, statuses } = makeSocket();
    const connecting = socket.connect();
    await Promise.resolve();
    const first = FakeSocket.created[0];
    expect(first.url).toBe('wss://octop.example.com/api/agents/a1/chat/ws?token=jwt-token');
    first.open();
    await connecting;
    expect(statuses.at(-1)?.status).toBe('open');
    socket.close();
  });

  it('uses ws:// for cleartext servers', async () => {
    const socket = new ChatSocket({
      baseUrl: 'http://192.168.1.10:8088',
      path: '/api/agents/a1/chat/ws',
      tokenFactory: () => Promise.resolve('t'),
      onFrame: () => undefined,
      onStatus: () => undefined,
      socketFactory: url => new FakeSocket(url) as unknown as WebSocket,
    });
    const connecting = socket.connect();
    await Promise.resolve();
    FakeSocket.created[0].open();
    await connecting;
    expect(FakeSocket.created[0].url.startsWith('ws://192.168.1.10:8088/')).toBe(true);
    socket.close();
  });

  it('delivers parsed frames and forwards sendUserTurn as JSON', async () => {
    const { socket, frames } = makeSocket();
    const connecting = socket.connect();
    await Promise.resolve();
    const first = FakeSocket.created[0];
    first.open();
    await connecting;

    first.serverMessage({ type: 'token', content: 'hello' });
    expect(frames).toHaveLength(1);

    const sent = socket.sendUserTurn({ text: 'ping?' });
    expect(sent).toBe(true);
    expect(JSON.parse(first.sent[0])).toMatchObject({ type: 'user_turn', text: 'ping?' });
    socket.close();
  });

  it('rejects sends while not open', () => {
    const { socket } = makeSocket();
    expect(socket.sendUserTurn({ text: 'x' })).toBe(false);
  });

  it('re-subscribes the active thread after reconnect', async () => {
    jest.useFakeTimers();
    const { socket } = makeSocket();
    const connecting = socket.connect();
    await Promise.resolve();
    const first = FakeSocket.created[0];
    first.open();
    await connecting;
    socket.subscribe('t-1');
    expect(JSON.parse(first.sent[0])).toMatchObject({ type: 'subscribe', thread_id: 't-1' });

    // Abnormal close → reconnect (first delay 10ms) → subscribe replays on the new socket.
    first.serverClose(1006);
    await jest.advanceTimersByTimeAsync(10);
    const second = FakeSocket.created[1];
    expect(second).toBeDefined();
    second.open();
    expect(JSON.parse(second.sent[0])).toMatchObject({ type: 'subscribe', thread_id: 't-1' });
    socket.close();
  });

  it('marks unauthorized on close 4001 and does not reconnect', async () => {
    const { socket, statuses } = makeSocket();
    const connecting = socket.connect();
    await Promise.resolve();
    FakeSocket.created[0].open();
    await connecting;
    FakeSocket.created[0].serverClose(4001);
    expect(statuses.at(-1)).toMatchObject({ status: 'unauthorized' });
    expect(FakeSocket.created).toHaveLength(1);
  });

  it('stops entirely after an explicit close', async () => {
    const { socket } = makeSocket();
    const connecting = socket.connect();
    await Promise.resolve();
    FakeSocket.created[0].open();
    await connecting;
    socket.close();
    expect(FakeSocket.created).toHaveLength(1);
  });

  it('rejects connect and stays terminal when the handshake is refused', async () => {
    const { socket, statuses } = makeSocket();
    const connecting = socket.connect();
    await Promise.resolve();
    // Handshake rejection: close fires without any open (generic 1006).
    FakeSocket.created[0].serverClose(1006);
    await expect(connecting).rejects.toThrow('connection refused');
    expect(statuses.at(-1)).toMatchObject({ status: 'closed' });
    expect(FakeSocket.created).toHaveLength(1);
  });
});
