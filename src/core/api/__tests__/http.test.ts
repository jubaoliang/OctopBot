import { HttpClient } from '../http';
import { OctopApiError } from '../errors';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function makeClient(overrides: Partial<ConstructorParameters<typeof HttpClient>[0]> = {}) {
  const onTokenRenewed = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
  const onUnauthorized = jest.fn<void, []>();
  const client = new HttpClient({
    baseUrl: 'https://octop.example.com',
    getToken: jest.fn<Promise<string | null>, []>().mockResolvedValue('token-1'),
    onTokenRenewed,
    onUnauthorized,
    ...overrides,
  });
  return { client, onTokenRenewed, onUnauthorized };
}

beforeEach(() => {
  globalThis.fetch = jest.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

describe('HttpClient', () => {
  it('attaches the bearer token from getToken', async () => {
    const { client } = makeClient();
    (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { ok: true }));

    await client.get('/api/health');

    const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://octop.example.com/api/health');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('skips the Authorization header on anonymous requests', async () => {
    const { client } = makeClient();
    (globalThis.fetch as jest.Mock).mockImplementation(() => jsonResponse(200, { ok: true }));

    await client.request('/api/health', { anonymous: true });

    const init = (globalThis.fetch as jest.Mock).mock.calls[0][1];
    expect(init.headers.Authorization ?? init.headers.authorization).toBeUndefined();
  });

  it('captures the sliding renewal token', async () => {
    const { client, onTokenRenewed } = makeClient();
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(200, { ok: true }, { 'X-Octop-Access-Token': 'token-2' }),
    );

    await client.get('/api/agents');

    expect(onTokenRenewed).toHaveBeenCalledWith('token-2');
  });

  it('does not capture renewal headers on anonymous requests', async () => {
    const { client, onTokenRenewed } = makeClient();
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(200, { ok: true }, { 'X-Octop-Access-Token': 'token-2' }),
    );

    await client.request('/api/health', { anonymous: true });

    expect(onTokenRenewed).not.toHaveBeenCalled();
  });

  it('parses error envelopes and signals unauthorized on 401', async () => {
    const { client, onUnauthorized } = makeClient();
    (globalThis.fetch as jest.Mock).mockImplementation(() =>
      jsonResponse(401, { error: { code: 'AUTH_FAILED', message: 'bad token' } }),
    );

    const first = client.get('/api/agents');
    const second = client.get('/api/agents');
    await expect(first).rejects.toThrow(OctopApiError);
    await expect(second).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it('returns undefined for 204 responses', async () => {
    const { client } = makeClient();
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));

    await expect(client.delete('/api/agents/a1/threads/t1')).resolves.toBeUndefined();
  });

  it('maps fetch failures to NETWORK_ERROR', async () => {
    const { client } = makeClient();
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('connection refused'));

    await expect(client.get('/api/health')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'connection refused',
    });
  });

  it('aborts after the timeout and reports it', async () => {
    jest.useFakeTimers();
    const { client } = makeClient({ timeoutMs: 100 });
    (globalThis.fetch as jest.Mock).mockImplementation(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const pending = client.get('/api/health');
    // Attach the rejection handler before advancing the clock, otherwise the
    // rejection fires unhandled while the timer helper is still awaiting.
    const expectation = expect(pending).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'request timed out',
    });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(150);
    await expectation;
  });
});
