import { UsageApi } from '../usage';
import type { HttpClient } from '../http';

function fakeHttp() {
  const paths: string[] = [];
  const http = {
    get: (path: string) => {
      paths.push(path);
      return Promise.resolve({ buckets: [] });
    },
  } as unknown as HttpClient;
  return { http, paths };
}

describe('UsageApi request shapes', () => {
  it('sends the server defaults explicitly', async () => {
    const { http, paths } = fakeHttp();
    await new UsageApi(http).summary();
    expect(paths).toEqual(['/api/usage/summary?window=last_30d&granularity=by_day']);
  });

  it('passes window, granularity and agent scope', async () => {
    const { http, paths } = fakeHttp();
    await new UsageApi(http).summary({
      window: 'last_7d',
      granularity: 'by_agent',
      agentId: 'ops agent/1',
    });
    expect(paths).toEqual([
      '/api/usage/summary?window=last_7d&granularity=by_agent&agent_id=ops%20agent%2F1',
    ]);
  });

  it('encodes the colons of a range window', async () => {
    const { http, paths } = fakeHttp();
    await new UsageApi(http).summary({
      window: 'range:2026-11-01:2026-11-07',
      granularity: 'total',
    });
    expect(paths).toEqual([
      '/api/usage/summary?window=range%3A2026-11-01%3A2026-11-07&granularity=total',
    ]);
  });
});
