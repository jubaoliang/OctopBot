import { isHttpUrl } from '../safe-url';

describe('isHttpUrl', () => {
  it('accepts ordinary web links', () => {
    expect(isHttpUrl('https://example.com/path')).toBe(true);
    expect(isHttpUrl('http://192.168.0.1:8080')).toBe(true);
  });

  it('rejects non-http schemes and garbage', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('mailto:a@b.c')).toBe(false);
    expect(isHttpUrl('octopbot://chat/hi')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });
});
