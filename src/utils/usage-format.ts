/**
 * Number and date text for the token usage screen. Pure string work — no
 * `Intl`, so every runtime (Hermes, JSC, HarmonyOS, Jest) prints the same.
 */

interface Unit {
  value: number;
  suffix: string;
}

// Largest first.
const ZH_UNITS: readonly Unit[] = [
  { value: 1e12, suffix: '万亿' },
  { value: 1e8, suffix: '亿' },
  { value: 1e4, suffix: '万' },
];

const EN_UNITS: readonly Unit[] = [
  { value: 1e12, suffix: 'T' },
  { value: 1e9, suffix: 'B' },
  { value: 1e6, suffix: 'M' },
  { value: 1e3, suffix: 'K' },
];

const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function isZh(locale: string): boolean {
  return locale.toLowerCase().startsWith('zh');
}

/** Whole count with thousands separators, e.g. 2788473 → "2,788,473". */
export function formatExactCount(n: number): string {
  if (!Number.isFinite(n)) {
    return '0';
  }
  const rounded = Math.round(n);
  const digits = Math.abs(rounded)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rounded < 0 ? `-${digits}` : digits;
}

/** Up to two decimals, fewer as the number grows; trailing zeros dropped. */
function trimScaled(scaled: number): string {
  const digits = scaled >= 1000 ? 0 : scaled >= 10 ? 1 : 2;
  return scaled
    .toFixed(digits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');
}

/**
 * Abbreviated count once `n` reaches `from`: 278.8万 / 1.23亿 in Chinese,
 * 2.79M / 1.23B in English. Below `from` the exact grouped number is kept.
 */
export function formatCompactCount(n: number, locale: string, from = 1_000_000): string {
  if (!Number.isFinite(n)) {
    return '0';
  }
  const abs = Math.abs(n);
  const units = isZh(locale) ? ZH_UNITS : EN_UNITS;
  let index = units.findIndex(unit => abs >= unit.value);
  if (abs < from || index === -1) {
    return formatExactCount(n);
  }
  let text = trimScaled(abs / units[index].value);
  // Rounding can reach the next unit (999,960 → "1000K"): step up to "1M".
  if (index > 0 && Number(text) * units[index].value >= units[index - 1].value) {
    index -= 1;
    text = trimScaled(abs / units[index].value);
  }
  return `${n < 0 ? '-' : ''}${text}${units[index].suffix}`;
}

/**
 * The text for a headline figure, plus the exact number to print under it
 * when the headline had to be abbreviated.
 */
export function usageCountDisplay(n: number, locale: string): { value: string; exact?: string } {
  const exact = formatExactCount(n);
  const value = formatCompactCount(n, locale);
  return value === exact ? { value } : { value, exact };
}

/** Share of a total as a whole percent; a non-zero sliver reads "<1%". */
export function formatShare(share: number): string {
  if (!Number.isFinite(share) || share <= 0) {
    return '0%';
  }
  const percent = Math.round(share * 100);
  return percent < 1 ? '<1%' : `${Math.min(percent, 100)}%`;
}

function parseDay(dayKey: string): { month: number; day: number } | null {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(dayKey);
  if (!match) {
    return null;
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? { month, day } : null;
}

/** "2026-11-06" → "11月6日" / "Nov 6". Unparseable keys are returned as is. */
export function formatDayLabel(dayKey: string, locale: string): string {
  const parsed = parseDay(dayKey);
  if (!parsed) {
    return dayKey;
  }
  return isZh(locale)
    ? `${parsed.month}月${parsed.day}日`
    : `${EN_MONTHS[parsed.month - 1]} ${parsed.day}`;
}

/** Compact axis label: "2026-11-06" → "11/6". */
export function formatDayShort(dayKey: string): string {
  const parsed = parseDay(dayKey);
  return parsed ? `${parsed.month}/${parsed.day}` : dayKey;
}
