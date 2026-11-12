import { speechLocaleFromUi } from '../speech-locale';

describe('speechLocaleFromUi', () => {
  it('maps Chinese UI locales to zh-CN', () => {
    expect(speechLocaleFromUi('zh')).toBe('zh-CN');
    expect(speechLocaleFromUi('zh-CN')).toBe('zh-CN');
    expect(speechLocaleFromUi('zh-Hans')).toBe('zh-CN');
  });

  it('maps other UI locales to en-US', () => {
    expect(speechLocaleFromUi('en')).toBe('en-US');
    expect(speechLocaleFromUi('en-US')).toBe('en-US');
  });
});
