import { AgentsApi } from '../agents';
import type { HttpClient } from '../http';

function fakeHttp() {
  const calls: { path: string }[] = [];
  const http = {
    get: (path: string) => {
      calls.push({ path });
      return Promise.resolve([]);
    },
    post: (path: string) => {
      calls.push({ path });
      return Promise.resolve(undefined);
    },
  } as unknown as HttpClient & { get: unknown; post: unknown };
  return { http: http, calls };
}

describe('AgentsApi request shapes', () => {
  it('defaults to scope=mine', async () => {
    const { http, calls } = fakeHttp();
    await new AgentsApi(http).list();
    expect(calls[0].path).toBe('/api/agents?scope=mine');
  });

  it('passes scope=all', async () => {
    const { http, calls } = fakeHttp();
    await new AgentsApi(http).list('all');
    expect(calls[0].path).toBe('/api/agents?scope=all');
  });

  it('builds agent action paths', async () => {
    const { http, calls } = fakeHttp();
    const api = new AgentsApi(http);
    await api.start('a1');
    await api.stop('a1');
    await api.markRead('a1');
    expect(calls.map(c => c.path)).toEqual([
      '/api/agents/a1/start',
      '/api/agents/a1/stop',
      '/api/agents/a1/read',
    ]);
  });
});
