import { parseServerList, removeServer, serializeServerList, upsertServer } from '../servers';

describe('server list', () => {
  it('parses a stored list and ignores garbage', () => {
    expect(parseServerList(null)).toEqual([]);
    expect(parseServerList('not json')).toEqual([]);
    expect(parseServerList('{"url":"x"}')).toEqual([]);
    const raw = serializeServerList([
      { url: 'https://a.example.com', lastUsed: 1 },
      { url: 'https://b.example.com', label: 'home', lastUsed: 2 },
    ]);
    expect(parseServerList(raw)).toHaveLength(2);
  });

  it('upserts by url, moves to front, keeps labels', () => {
    let list = upsertServer([], 'https://a.example.com', undefined, 1);
    list = upsertServer(list, 'https://b.example.com', 'home', 2);
    list = upsertServer(list, 'https://a.example.com', undefined, 3);
    expect(list.map(e => e.url)).toEqual(['https://a.example.com', 'https://b.example.com']);
    expect(list[1].label).toBe('home');
  });

  it('caps the list at five entries', () => {
    let list: ReturnType<typeof upsertServer> = [];
    for (let i = 0; i < 8; i++) {
      list = upsertServer(list, `https://s${i}.example.com`, undefined, i);
    }
    expect(list).toHaveLength(5);
  });

  it('removes by url', () => {
    let list = upsertServer([], 'https://a.example.com', undefined, 1);
    list = removeServer(list, 'https://a.example.com');
    expect(list).toHaveLength(0);
  });
});
