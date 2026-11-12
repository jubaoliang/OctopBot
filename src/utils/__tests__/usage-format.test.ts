import {
  formatCompactCount,
  formatDayLabel,
  formatDayShort,
  formatExactCount,
  formatShare,
  usageCountDisplay,
} from '../usage-format';

describe('formatExactCount', () => {
  it('groups thousands', () => {
    expect(formatExactCount(0)).toBe('0');
    expect(formatExactCount(999)).toBe('999');
    expect(formatExactCount(1000)).toBe('1,000');
    expect(formatExactCount(2788473)).toBe('2,788,473');
  });

  it('rounds fractions and keeps the sign', () => {
    expect(formatExactCount(1234.6)).toBe('1,235');
    expect(formatExactCount(-45000)).toBe('-45,000');
  });

  it('prints 0 for values that are not numbers', () => {
    expect(formatExactCount(Number.NaN)).toBe('0');
    expect(formatExactCount(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('formatCompactCount', () => {
  it('keeps exact figures below the threshold', () => {
    expect(formatCompactCount(999_999, 'zh')).toBe('999,999');
    expect(formatCompactCount(999_999, 'en')).toBe('999,999');
  });

  it('uses 万 / 亿 in Chinese', () => {
    expect(formatCompactCount(2_788_473, 'zh')).toBe('278.8万');
    expect(formatCompactCount(123_000_000, 'zh-CN')).toBe('1.23亿');
    expect(formatCompactCount(1_000_000, 'zh')).toBe('100万');
  });

  it('uses M / B in English', () => {
    expect(formatCompactCount(2_788_473, 'en')).toBe('2.79M');
    expect(formatCompactCount(1_230_000_000, 'en-US')).toBe('1.23B');
  });

  it('honours a lower threshold for small labels', () => {
    expect(formatCompactCount(12_340, 'zh', 10_000)).toBe('1.23万');
    expect(formatCompactCount(12_340, 'en', 10_000)).toBe('12.3K');
    expect(formatCompactCount(9_999, 'en', 10_000)).toBe('9,999');
    expect(formatCompactCount(50_000, 'en', 1_000)).toBe('50K');
  });

  it('steps up a unit when rounding reaches it', () => {
    expect(formatCompactCount(999_960, 'en', 1_000)).toBe('1M');
    expect(formatCompactCount(99_999_999, 'zh')).toBe('1亿');
  });

  it('stays exact when no unit is small enough', () => {
    expect(formatCompactCount(5_000, 'zh', 1_000)).toBe('5,000');
  });

  it('handles negatives and non-numbers', () => {
    expect(formatCompactCount(-2_500_000, 'en')).toBe('-2.5M');
    expect(formatCompactCount(Number.NaN, 'en')).toBe('0');
  });
});

describe('usageCountDisplay', () => {
  it('returns only the value when nothing was abbreviated', () => {
    expect(usageCountDisplay(45_000, 'zh')).toEqual({ value: '45,000' });
  });

  it('adds the exact figure when abbreviated', () => {
    expect(usageCountDisplay(2_788_473, 'zh')).toEqual({
      value: '278.8万',
      exact: '2,788,473',
    });
  });
});

describe('formatShare', () => {
  it('rounds to a whole percent', () => {
    expect(formatShare(0.426)).toBe('43%');
    expect(formatShare(1)).toBe('100%');
  });

  it('marks slivers instead of rounding them to zero', () => {
    expect(formatShare(0.004)).toBe('<1%');
  });

  it('is 0% for nothing or nonsense', () => {
    expect(formatShare(0)).toBe('0%');
    expect(formatShare(Number.NaN)).toBe('0%');
    expect(formatShare(-0.2)).toBe('0%');
  });
});

describe('day labels', () => {
  it('formats a day for each locale', () => {
    expect(formatDayLabel('2026-11-06', 'zh')).toBe('11月6日');
    expect(formatDayLabel('2026-11-06', 'en')).toBe('Nov 6');
    expect(formatDayLabel('2026-01-31', 'en')).toBe('Jan 31');
  });

  it('formats a short axis label', () => {
    expect(formatDayShort('2026-11-06')).toBe('11/6');
    expect(formatDayShort('2026-01-31')).toBe('1/31');
  });

  it('returns keys it cannot parse unchanged', () => {
    expect(formatDayLabel('week 45', 'zh')).toBe('week 45');
    expect(formatDayShort('2026-13-40')).toBe('2026-13-40');
  });
});
