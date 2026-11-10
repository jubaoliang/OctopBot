import { AuthApi, isMfaChallenge } from '../auth';
import { HttpClient } from '../http';
import { readableText } from '../threads';

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = jest.fn();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AuthApi.login', () => {
  it('posts anonymously and detects the MFA branch', async () => {
    (globalThis.fetch as jest.Mock).mockImplementation(() =>
      jsonResponse(200, {
        mfa_required: true,
        mfa_token: 'challenge',
        methods: ['totp'],
        user_hint: null,
        locale: null,
      }),
    );
    const api = new AuthApi(
      new HttpClient({
        baseUrl: 'https://octop.example.com',
        getToken: () => Promise.resolve('stale-token'),
        onTokenRenewed: () => Promise.resolve(),
        onUnauthorized: () => undefined,
      }),
    );

    const response = await api.login('user', 'pass');

    const init = (globalThis.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(isMfaChallenge(response)).toBe(true);
    if (isMfaChallenge(response)) {
      expect(response.mfa_token).toBe('challenge');
    }
  });
});

describe('readableText', () => {
  it('joins text blocks and skips thinking/tool blocks', () => {
    expect(
      readableText([
        { type: 'thinking', thinking: 'pondering' },
        { type: 'text', text: 'Hello ' },
        { type: 'tool_use', name: 'search', id: '1', input: {} },
        { type: 'text', text: 'world' },
      ]),
    ).toBe('Hello world');
  });

  it('returns empty string when nothing is readable', () => {
    expect(readableText([{ type: 'thinking', thinking: 'x' }])).toBe('');
  });
});
