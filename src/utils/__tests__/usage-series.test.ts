import { dailySeries, rankBuckets, shiftDay, utcDayOfEpoch } from '../usage-series';

const bucket = (key: string, total_tokens: number, label = key) => ({ key, label, total_tokens });

/** Unix seconds for a UTC date-time. */
const epoch = (iso: string) => Date.parse(iso) / 1000;

describe('shiftDay', () => {
  it('crosses month and year boundaries', () => {
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('leaves unparseable keys alone', () => {
    expect(shiftDay('nope', 3)).toBe('nope');
  });
});

describe('utcDayOfEpoch', () => {
  it('takes the UTC calendar day', () => {
    expect(utcDayOfEpoch(epoch('2026-11-12T02:45:00Z'))).toBe('2026-11-12');
    expect(utcDayOfEpoch(epoch('2026-11-12T23:59:59Z'))).toBe('2026-11-12');
  });

  it('rejects zero, negatives and non-numbers', () => {
    expect(utcDayOfEpoch(0)).toBeNull();
    expect(utcDayOfEpoch(-5)).toBeNull();
    expect(utcDayOfEpoch(Number.NaN)).toBeNull();
  });
});

describe('dailySeries', () => {
  const end = epoch('2026-11-12T02:45:00Z');

  it('fills missing days with zero, oldest first', () => {
    const series = dailySeries([bucket('2026-11-12', 300), bucket('2026-11-09', 100)], 7, end);
    expect(series.map(p => p.key)).toEqual([
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ]);
    expect(series.map(p => p.value)).toEqual([0, 0, 0, 100, 0, 0, 300]);
  });

  it('returns a full run of zero days when nothing was used', () => {
    const series = dailySeries([], 7, end);
    expect(series).toHaveLength(7);
    expect(series.at(-1)).toEqual({ key: '2026-11-12', value: 0 });
    expect(series.every(p => p.value === 0)).toBe(true);
  });

  it('keeps the extra day a rolling window reaches back into', () => {
    // last_7d = now − 7×24h, which starts partway through an eighth day.
    const series = dailySeries([bucket('2026-11-12', 10), bucket('2026-11-05', 40)], 7, end);
    expect(series).toHaveLength(8);
    expect(series[0]).toEqual({ key: '2026-11-05', value: 40 });
  });

  it('never grows by more than that one day', () => {
    const series = dailySeries([bucket('2026-11-12', 10), bucket('2026-10-01', 40)], 7, end);
    expect(series).toHaveLength(8);
    expect(series[0].key).toBe('2026-11-05');
  });

  it('ends on the newest bucket when the server is ahead of UTC', () => {
    const series = dailySeries([bucket('2026-11-13', 5)], 3, end);
    expect(series.map(p => p.key)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it('treats the range end as exclusive at midnight', () => {
    const series = dailySeries([], 2, epoch('2026-11-12T00:00:00Z'));
    expect(series.map(p => p.key)).toEqual(['2026-11-10', '2026-11-11']);
  });

  it('falls back to the newest bucket without a usable range end', () => {
    const series = dailySeries([bucket('2026-11-10', 7)], 2, 0);
    expect(series).toEqual([
      { key: '2026-11-09', value: 0 },
      { key: '2026-11-10', value: 7 },
    ]);
    expect(dailySeries([], 7, 0)).toEqual([]);
  });

  it('sums buckets that share a day and ignores time suffixes', () => {
    const series = dailySeries([bucket('2026-11-12T00:00:00', 2), bucket('2026-11-12', 3)], 1, end);
    expect(series).toEqual([{ key: '2026-11-12', value: 5 }]);
  });

  it('shows unknown key formats as sent, oldest first', () => {
    const series = dailySeries([bucket('week 46', 9), bucket('week 45', 4)], 7, end);
    expect(series).toEqual([
      { key: 'week 45', value: 4 },
      { key: 'week 46', value: 9 },
    ]);
  });

  it('is empty for a non-positive day count', () => {
    expect(dailySeries([bucket('2026-11-12', 1)], 0, end)).toEqual([]);
  });
});

describe('rankBuckets', () => {
  it('orders by value and measures share and bar length', () => {
    const { rows, rest } = rankBuckets([bucket('b', 25), bucket('a', 75, 'Alpha')], 5);
    expect(rows).toEqual([
      { key: 'a', label: 'Alpha', value: 75, share: 0.75, relative: 1 },
      { key: 'b', label: 'b', value: 25, share: 0.25, relative: 25 / 75 },
    ]);
    expect(rest).toBeNull();
  });

  it('rolls everything past the limit into one remainder', () => {
    const { rows, rest } = rankBuckets(
      [bucket('a', 50), bucket('b', 30), bucket('c', 15), bucket('d', 5)],
      2,
    );
    expect(rows.map(r => r.key)).toEqual(['a', 'b']);
    expect(rest).toEqual({ count: 2, value: 20, share: 0.2, relative: 0.4 });
  });

  it('drops empty buckets and survives an empty list', () => {
    expect(rankBuckets([bucket('a', 0)], 5)).toEqual({ rows: [], rest: null });
    expect(rankBuckets([], 5)).toEqual({ rows: [], rest: null });
  });

  it('does not reorder the caller’s array', () => {
    const input = [bucket('small', 1), bucket('big', 9)];
    rankBuckets(input, 5);
    expect(input.map(b => b.key)).toEqual(['small', 'big']);
  });
});
