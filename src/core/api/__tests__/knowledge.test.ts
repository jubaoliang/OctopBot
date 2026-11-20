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
    put: (path: string, body?: unknown) => {
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

  it('unwraps preview JSON envelope to plain text', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({
        id: 'd1',
        filename: 'note.md',
        text: '# Hello\n\nbody',
      }),
    } as unknown as HttpClient;
    await expect(new KnowledgeApi(http).preview('kb1', 'd1')).resolves.toBe('# Hello\n\nbody');
    expect(http.get).toHaveBeenCalledWith('/api/knowledge-bases/kb1/documents/d1/preview');
  });

  it('accepts a plain-string preview response', async () => {
    const http = {
      get: jest.fn().mockResolvedValue('raw preview'),
    } as unknown as HttpClient;
    await expect(new KnowledgeApi(http).preview('kb1', 'd1')).resolves.toBe('raw preview');
  });

  it('creates a private base with a description', async () => {
    const { http, calls } = fakeHttp();
    await new KnowledgeApi(http).createBase('My Schedule', 'Rolling device schedule');
    expect(calls[0]).toEqual({
      path: '/api/knowledge-bases',
      body: { name: 'My Schedule', description: 'Rolling device schedule', shared: false },
    });
  });

  it('creates a markdown text document with content', async () => {
    const { http, calls } = fakeHttp();
    await new KnowledgeApi(http).createTextDocument('kb1', {
      name: 'schedule.md',
      content: '# Schedule',
    });
    expect(calls[0]).toEqual({
      path: '/api/knowledge-bases/kb1/documents/text',
      body: { name: 'schedule.md', format: 'md', content: '# Schedule' },
    });
  });

  it('creates a plain-text document when format is txt', async () => {
    const { http, calls } = fakeHttp();
    await new KnowledgeApi(http).createTextDocument('kb1', {
      name: 'notes.txt',
      content: 'hi',
      format: 'txt',
    });
    expect(calls[0].body).toMatchObject({ format: 'txt' });
  });

  it('updates document content', async () => {
    const { http, calls } = fakeHttp();
    await new KnowledgeApi(http).updateTextContent('kb1', 'doc1', '# Updated');
    expect(calls[0]).toEqual({
      path: '/api/knowledge-bases/kb1/documents/doc1/content',
      body: { content: '# Updated' },
    });
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
