/** @jest-environment node */
import { request as httpsRequest } from 'node:https';
import { AgentsApi } from '../agents';
import { AuthApi } from '../auth';
import { HttpClient } from '../http';
import { ThreadsApi } from '../threads';
import { ChatSocket } from '../../chat/chat-socket';
import type { ServerFrame } from '../types';

/**
 * jest-expo's setup replaces global fetch with a stub; this suite needs real
 * networking, so restore a minimal WHATWG-shaped fetch over node:https.
 */
function realFetch(url: string, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = init?.body === undefined || init.body === null ? null : String(init.body);
    const req = httpsRequest(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: init?.method ?? 'GET',
        headers: {
          ...(init?.headers as Record<string, string> | undefined),
          ...(body ? { 'Content-Length': String(Buffer.byteLength(body)) } : {}),
        },
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf8');
          // 204/304 forbid bodies; Node's Response rejects them otherwise.
          const bodyless = res.statusCode === 204 || res.statusCode === 304;
          resolve(
            new Response(bodyless ? null : text, {
              status: res.statusCode ?? 0,
              headers: Object.fromEntries(
                Object.entries(res.headers).map(([k, v]) => [
                  k,
                  Array.isArray(v) ? v.join(', ') : String(v),
                ]),
              ),
            }),
          );
        });
      },
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Run before any module-level HttpClient use below.
(globalThis as { fetch: typeof fetch }).fetch = realFetch as typeof fetch;

/**
 * Real-server integration scenario — multi-expert, multi-thread.
 *
 * Gated by environment variables so normal unit runs (and CI without a
 * server) skip it entirely:
 *   OCTOP_E2E_URL   e.g. https://octop.example.com   (no trailing path)
 *   OCTOP_E2E_USER  username
 *   OCTOP_E2E_PW    password
 * Run: OCTOP_E2E_URL=… OCTOP_E2E_USER=… OCTOP_E2E_PW=… npx jest integration.scenario
 *
 * The scenario exercises the app's own core clients (HttpClient, AuthApi,
 * ThreadsApi, ChatSocket) end to end: per expert — create two threads,
 * stream a chat turn over the WebSocket on each, read back history,
 * rename + pin, then delete one thread. Created experts are cleaned up.
 */

const BASE_URL = process.env.OCTOP_E2E_URL;
const USERNAME = process.env.OCTOP_E2E_USER;
const PASSWORD = process.env.OCTOP_E2E_PW;

const enabled = Boolean(BASE_URL && USERNAME && PASSWORD && typeof WebSocket !== 'undefined');

const jestTimeout = 180_000;

const scenario = enabled ? describe : describe.skip;

scenario('integration: multi-expert chat scenario', () => {
  jest.setTimeout(jestTimeout);
  let token = '';
  let http: HttpClient;
  const createdAgentIds: string[] = [];
  // Unique per run — killed runs can leave same-named experts behind.
  const runTag = `${Date.now()}`;
  const expertNames = [`scenario-ops-${runTag}`, `scenario-writer-${runTag}`];

  beforeAll(async () => {
    const bootstrap = new HttpClient({
      baseUrl: BASE_URL!,
      getToken: () => Promise.resolve(null),
      onTokenRenewed: () => Promise.resolve(),
      onUnauthorized: () => undefined,
    });
    const result = await new AuthApi(bootstrap).login(USERNAME!, PASSWORD!);
    expect(result).toMatchObject({ access_token: expect.any(String) });
    token = (result as { access_token: string }).access_token;

    http = new HttpClient({
      baseUrl: BASE_URL!,
      getToken: () => Promise.resolve(token),
      onTokenRenewed: async renewed => {
        token = renewed;
      },
      onUnauthorized: () => undefined,
    });
    const sweepApi = new AgentsApi(http);
    const existing = await sweepApi.list().catch(() => []);
    for (const agent of existing) {
      if (agent.name.startsWith('scenario-')) {
        await sweepApi.deleteAgentQuietly(agent.agent_id);
      }
    }
  });

  afterAll(async () => {
    for (const agentId of createdAgentIds) {
      await new AgentsApi(http).deleteAgentQuietly(agentId);
    }
  });

  it('creates two experts', async () => {
    const api = new AgentsApi(http);
    for (const name of expertNames) {
      const agent = await api.create({ name, description: 'integration scenario expert' });
      expect(agent.agent_id).toBeTruthy();
      createdAgentIds.push(agent.agent_id);
    }
    const agents = await api.list();
    const names = agents.map(a => a.name);
    expect(names).toContain(expertNames[0]);
    expect(names).toContain(expertNames[1]);
  });

  for (const expertIndex of [0, 1]) {
    describe(`expert #${expertIndex}`, () => {
      const threadIds: string[] = [];

      afterAll(async () => {
        const threads = new ThreadsApi(http);
        for (const threadId of threadIds) {
          await threads.removeQuietly(createdAgentIds[expertIndex], threadId);
        }
      });

      it('opens two threads and streams a chat turn on each', async () => {
        const agentId = createdAgentIds[expertIndex];
        const threads = new ThreadsApi(http);
        for (let i = 0; i < 2; i++) {
          const created = await threads.create(agentId);
          expect(created.thread_id).toBeTruthy();
          threadIds.push(created.thread_id);
        }

        for (const [i, threadId] of threadIds.entries()) {
          const frames = await streamTurn(
            agentId,
            threadId,
            `你好，这是集成测试消息 ${i + 1}，请回复"收到"。`,
          );
          const types = frames.map(f => f.type);
          expect(types).toContain('done');
          const tokens = frames
            .filter((f): f is Extract<ServerFrame, { type: 'token' }> => f.type === 'token')
            .map(f => f.content)
            .join('');
          expect(tokens.length).toBeGreaterThan(0);
        }
      });

      it('persists history with both roles', async () => {
        const agentId = createdAgentIds[expertIndex];
        const list = await new ThreadsApi(http).list(agentId);
        // The other expert's threads must not leak into this one's list.
        for (const threadId of threadIds) {
          expect(list.some(t => t.thread_id === threadId)).toBe(true);
        }
        const page = await new ThreadsApi(http).history(agentId, threadIds[0], { limit: 25 });
        const roles = new Set(page.messages.map(m => m.role));
        expect(roles.has('user')).toBe(true);
        expect(roles.has('assistant')).toBe(true);
      });

      it('renames and pins, then deletes one thread', async () => {
        const agentId = createdAgentIds[expertIndex];
        const threads = new ThreadsApi(http);
        const renamed = await threads.update(agentId, threadIds[0], {
          title: 'scenario-renamed',
          pinned: true,
        });
        expect(renamed.pinned).toBe(true);

        await threads.remove(agentId, threadIds[1]);
        const list = await threads.list(agentId);
        expect(list.some(t => t.thread_id === threadIds[1])).toBe(false);
        threadIds.pop();
      });
    });
  }

  /** Streams one turn and resolves when the server sends `done`. */
  function streamTurn(agentId: string, threadId: string, text: string): Promise<ServerFrame[]> {
    return new Promise((resolve, reject) => {
      const frames: ServerFrame[] = [];
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error(`no done frame within ${jestTimeout}ms`));
      }, jestTimeout - 5_000);
      const socket = new ChatSocket({
        baseUrl: BASE_URL!,
        path: `/api/agents/${agentId}/chat/ws`,
        tokenFactory: () => Promise.resolve(token),
        onFrame: frame => {
          frames.push(frame);
          if (frame.type === 'done' || frame.type === 'error') {
            clearTimeout(timer);
            // Settle first: close() synchronously emits status 'closed',
            // which must not race the resolution below.
            if (frame.type === 'error') {
              reject(new Error(`server error frame: ${frame.message}`));
            } else {
              resolve(frames);
            }
            socket.close();
          }
        },
        onStatus: status => {
          if (status === 'unauthorized' || status === 'closed') {
            clearTimeout(timer);
            reject(new Error(`socket status ${status} before done`));
          }
        },
      });
      void socket.connect().then(() => {
        socket.subscribe(threadId);
        const sent = socket.sendUserTurn({ text, thread_id: threadId });
        if (!sent) {
          clearTimeout(timer);
          reject(new Error('sendUserTurn returned false'));
        }
      });
    });
  }
});
