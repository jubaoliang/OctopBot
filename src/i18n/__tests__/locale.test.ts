import { localeFromTag } from '../I18nProvider';

describe('localeFromTag', () => {
  it('maps English tags to en', () => {
    expect(localeFromTag('en')).toBe('en');
    expect(localeFromTag('en-US')).toBe('en');
    expect(localeFromTag('en-GB')).toBe('en');
  });

  it('maps everything else to zh', () => {
    expect(localeFromTag('zh')).toBe('zh');
    expect(localeFromTag('zh-CN')).toBe('zh');
    expect(localeFromTag('zh-Hans-CN')).toBe('zh');
    expect(localeFromTag('ja-JP')).toBe('zh');
    expect(localeFromTag('fr')).toBe('zh');
  });
});
