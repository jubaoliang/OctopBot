import { CronApi, KnowledgeApi } from '../knowledge';
import type { HttpClient } from '../http';

function fakeHttp() {
  const calls: { path: string; body?: unknown }[] = [];
  const http = {
    get: (path: string) => {
      calls.push({ path });
      return Promise.resolve([]);
    },
    post: (path: string, body?: unknown) => {
      calls.push({ path, body });
      return Promise.resolve(undefined);
    },
    patch: (path: string, body?: unknown) => {
      calls.push({ path, body });
      return Promise.resolve(undefined);
    },
    delete: (path: string) => {
      calls.push({ path });
      return Promise.resolve(undefined);
    },
  } as unknown as HttpClient;
  return { http, calls };
}

describe('KnowledgeApi request shapes', () => {
  it('lists bases and documents with encoded prefix', async () => {
    const { http, calls } = fakeHttp();
    const api = new KnowledgeApi(http);
    await api.bases();
    await api.documents('kb1');
    await api.documents('kb1', 'docs/sub folder');
    expect(calls.map(c => c.path)).toEqual([
      '/api/knowledge-bases',
      '/api/knowledge-bases/kb1/documents',
      '/api/knowledge-bases/kb1/documents?prefix=docs%2Fsub%20folder',
    ]);
  });
});

describe('CronApi request shapes', () => {
  it('builds cron CRUD paths', async () => {
    const { http, calls } = fakeHttp();
    const api = new CronApi(http);
    await api.list('a1');
    await api.create('a1', { trigger: 'cron:0 9 * * *', prompt: 'standup', enabled: true });
    await api.update('a1', 'c1', { enabled: false });
    await api.remove('a1', 'c1');
    await api.runNow('a1', 'c1');
    expect(calls.map(c => c.path)).toEqual([
      '/api/agents/a1/cron',
      '/api/agents/a1/cron',
      '/api/agents/a1/cron/c1',
      '/api/agents/a1/cron/c1',
      '/api/agents/a1/cron/c1/run-now',
    ]);
    expect(calls[1].body).toMatchObject({ trigger: 'cron:0 9 * * *', enabled: true });
    expect(calls[2].body).toEqual({ enabled: false });
  });
});
