import type { QuickPromptItem, QuickPrompts, TaskExamples } from '@/core/api/types';

import { resolveLocalized, resolveQuickPrompts, resolveTaskExamples } from '../quick-prompts';

function item(overrides: Partial<QuickPromptItem> = {}): QuickPromptItem {
  return {
    title: { zh: '总结内容', en: 'Summarize' },
    prompt: {
      zh: '请帮我总结以下内容，提取核心要点：\n\n',
      en: 'Please summarize the following and extract the key points:\n\n',
    },
    ...overrides,
  };
}

describe('resolveLocalized', () => {
  it('passes plain strings through', () => {
    expect(resolveLocalized('hello', 'en')).toBe('hello');
    expect(resolveLocalized('你好', 'zh-CN')).toBe('你好');
  });

  it('picks the locale branch with cross-locale fallback', () => {
    const value = { zh: '中文', en: 'English' };
    expect(resolveLocalized(value, 'zh-CN')).toBe('中文');
    expect(resolveLocalized(value, 'en-US')).toBe('English');
    expect(resolveLocalized({ zh: '中文' }, 'en')).toBe('中文');
    expect(resolveLocalized({ en: 'English' }, 'zh')).toBe('English');
  });

  it('returns null for empty or missing copy', () => {
    expect(resolveLocalized(null, 'en')).toBeNull();
    expect(resolveLocalized(undefined, 'en')).toBeNull();
    expect(resolveLocalized('', 'en')).toBeNull();
    expect(resolveLocalized({}, 'en')).toBeNull();
    expect(resolveLocalized({ zh: '', en: '' }, 'en')).toBeNull();
  });

  it('falls back when the preferred branch exists but is empty', () => {
    expect(resolveLocalized({ zh: '', en: 'English' }, 'zh')).toBe('English');
    expect(resolveLocalized({ en: '', zh: '中文' }, 'en')).toBe('中文');
  });
});

describe('resolveQuickPrompts', () => {
  it('returns [] for null/undefined payloads', () => {
    expect(resolveQuickPrompts(null, 'en')).toEqual([]);
    expect(resolveQuickPrompts(undefined as unknown as QuickPrompts, 'en')).toEqual([]);
  });

  it('resolves rich items to label + prompt body + icon', () => {
    const payload: QuickPrompts = [item({ icon_name: 'file-text' })];
    expect(resolveQuickPrompts(payload, 'en')).toEqual([
      {
        label: 'Summarize',
        text: 'Please summarize the following and extract the key points:\n\n',
        iconName: 'file-text',
      },
    ]);
    expect(resolveQuickPrompts(payload, 'zh-CN')).toEqual([
      {
        label: '总结内容',
        text: '请帮我总结以下内容，提取核心要点：\n\n',
        iconName: 'file-text',
      },
    ]);
  });

  it('falls back to the title when the prompt body is missing', () => {
    const payload: QuickPrompts = [item({ prompt: undefined as never })];
    expect(resolveQuickPrompts(payload, 'en')).toEqual([{ label: 'Summarize', text: 'Summarize' }]);
  });

  it('skips items without a usable title and non-string junk', () => {
    const payload = [item({ title: {} }), 42, null, 'plain'] as unknown as QuickPrompts;
    expect(resolveQuickPrompts(payload, 'en')).toEqual([{ label: 'plain', text: 'plain' }]);
  });

  it('still resolves legacy plain-string lists', () => {
    expect(resolveQuickPrompts(['a', '', 'b'], 'en')).toEqual([
      { label: 'a', text: 'a' },
      { label: 'b', text: 'b' },
    ]);
  });

  it('still resolves legacy {zh,en} string-list pairs with fallback', () => {
    expect(resolveQuickPrompts({ zh: ['甲'], en: ['A'] }, 'zh')).toEqual([
      { label: '甲', text: '甲' },
    ]);
    expect(resolveQuickPrompts({ zh: ['甲'] }, 'en')).toEqual([{ label: '甲', text: '甲' }]);
    expect(resolveQuickPrompts({}, 'en')).toEqual([]);
  });
});

describe('resolveTaskExamples', () => {
  it('picks the locale branch with fallback and filters junk', () => {
    const payload: TaskExamples = { zh: ['每天九点简报'], en: ['Daily briefing at 9', ''] };
    expect(resolveTaskExamples(payload, 'en')).toEqual(['Daily briefing at 9']);
    expect(resolveTaskExamples(payload, 'zh-CN')).toEqual(['每天九点简报']);
    expect(resolveTaskExamples({ en: ['x'] }, 'zh')).toEqual(['x']);
    expect(resolveTaskExamples(null, 'en')).toEqual([]);
  });

  it('falls back when the preferred branch is an empty list', () => {
    expect(resolveTaskExamples({ zh: [], en: ['A'] }, 'zh')).toEqual(['A']);
    expect(resolveTaskExamples({ en: [], zh: ['甲'] }, 'en')).toEqual(['甲']);
  });
});
