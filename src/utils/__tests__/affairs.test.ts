import { parseAffairs } from '../affairs';

describe('parseAffairs', () => {
  it('parses a clean JSON array of affairs', () => {
    const text = '[{"title":"Pay CITIC bill","due":"11/27","status":"open"}]';
    expect(parseAffairs(text)).toEqual([{ title: 'Pay CITIC bill', due: '11/27', status: 'open' }]);
  });

  it('extracts an array wrapped in prose / code fence', () => {
    const text =
      'Here are your affairs:\n```json\n[{"title":"Fly to SZX","due":"11/27"}]\n```\nDone.';
    expect(parseAffairs(text)).toEqual([{ title: 'Fly to SZX', due: '11/27' }]);
  });

  it('accepts plain strings and alternate keys', () => {
    const text = '["Call bank", {"name":"Review PR","deadline":"Fri"}]';
    expect(parseAffairs(text)).toEqual([
      { title: 'Call bank' },
      { title: 'Review PR', due: 'Fri' },
    ]);
  });

  it('skips items without a usable title', () => {
    const text = '[{"due":"tomorrow"}, {"title":"  "}, {"title":"ok"}]';
    expect(parseAffairs(text)).toEqual([{ title: 'ok' }]);
  });

  it('returns [] for empty / non-JSON / non-array input', () => {
    expect(parseAffairs('')).toEqual([]);
    expect(parseAffairs('no json here')).toEqual([]);
    expect(parseAffairs('{"title":"not an array"}')).toEqual([]);
    expect(parseAffairs('[broken')).toEqual([]);
  });
});
