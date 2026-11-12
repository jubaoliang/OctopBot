import { cleartextAckStorageKey, cleartextOrigin, isCleartext, normalizeBaseUrl } from '../urls';

describe('normalizeBaseUrl', () => {
  it('adds https:// when the scheme is missing', () => {
    expect(normalizeBaseUrl('octop.lan:8088')).toBe('https://octop.lan:8088');
  });

  it('preserves an explicit http scheme for LAN servers', () => {
    expect(normalizeBaseUrl('http://192.168.1.10:8088')).toBe('http://192.168.1.10:8088');
  });

  it('strips trailing slash, path, query, and hash', () => {
    expect(normalizeBaseUrl('https://example.com/octop/dashboard?x=1#chat/')).toBe(
      'https://example.com',
    );
  });

  it('strips embedded username and password', () => {
    expect(normalizeBaseUrl('http://alice:secret@192.168.1.10:8088/path')).toBe(
      'http://192.168.1.10:8088',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeBaseUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('rejects empty and blank input', () => {
    expect(() => normalizeBaseUrl('')).toThrow('empty URL');
    expect(() => normalizeBaseUrl('   ')).toThrow('empty URL');
  });

  it('rejects unparsable input', () => {
    expect(() => normalizeBaseUrl('https://')).toThrow('invalid URL');
  });
});

describe('isCleartext', () => {
  it('detects http', () => {
    expect(isCleartext('http://10.0.0.2:8088')).toBe(true);
  });

  it('passes https', () => {
    expect(isCleartext('https://octop.example.com')).toBe(false);
  });
});

describe('cleartextOrigin', () => {
  it('keeps scheme host and port', () => {
    expect(cleartextOrigin('http://10.0.0.2:8088')).toBe('http://10.0.0.2:8088');
    expect(cleartextAckStorageKey('http://10.0.0.2:8088')).toBe(
      'octop.cleartextAck.http___10.0.0.2_8088',
    );
  });
});
