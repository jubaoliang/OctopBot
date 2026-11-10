import { ThreadsApi, composeUserTurn } from '../threads';
import type { HttpClient } from '../http';

function fakeHttp() {
  const calls: { path: string; body?: unknown }[] = [];
  const http = {
    get: (path: string) => {
      calls.push({ path });
      return Promise.resolve({ messages: [] });
    },
    post: (path: string, body?: unknown) => {
      calls.push({ path, body });
      return Promise.resolve({ thread_id: 't1', session_key: 's1' });
    },
    patch: (path: string, body?: unknown) => {
      calls.push({ path, body });
      return Promise.resolve({});
    },
    delete: (path: string) => {
      calls.push({ path });
      return Promise.resolve(undefined);
    },
  } as unknown as HttpClient;
  return { http, calls };
}

describe('ThreadsApi request shapes', () => {
  it('builds thread CRUD paths', async () => {
    const { http, calls } = fakeHttp();
    const api = new ThreadsApi(http);
    await api.list('a1');
    await api.create('a1');
    await api.history('a1', 't1', { limit: 25, cursor: 'abc' });
    await api.update('a1', 't1', { pinned: true });
    await api.remove('a1', 't1');
    await api.cancel('a1', 't1');
    expect(calls.map(c => c.path)).toEqual([
      '/api/agents/a1/threads?limit=50',
      '/api/agents/a1/threads',
      '/api/agents/a1/threads/t1/history?limit=25&cursor=abc',
      '/api/agents/a1/threads/t1',
      '/api/agents/a1/threads/t1',
      '/api/agents/a1/threads/t1/cancel',
    ]);
    expect(calls[3].body).toEqual({ pinned: true });
  });
});

describe('composeUserTurn', () => {
  it('passes attachments through as TurnAttachments', () => {
    const turn = composeUserTurn({
      text: 'look at this',
      attachments: [{ type: 'image', workspace_path: 'inbound/pic.png', filename: 'pic.png' }],
    });
    expect(turn.attachments).toEqual([
      { type: 'image', workspace_path: 'inbound/pic.png', filename: 'pic.png' },
    ]);
  });

  it('defaults attachments to an empty list', () => {
    expect(composeUserTurn({ text: 'hi' }).attachments).toEqual([]);
  });
});
