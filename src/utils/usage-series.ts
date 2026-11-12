/**
 * Shapes usage buckets for display: a gap-free daily series for the bar
 * chart and a ranked, capped list for the per-expert / per-model breakdown.
 */

export interface ValueBucket {
  key: string;
  label: string;
  total_tokens: number;
}

export interface DailyPoint {
  /** `YYYY-MM-DD`. */
  key: string;
  value: number;
}

const DAY_MS = 86_400_000;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})/;

function dayToUtcMs(dayKey: string): number | null {
  const match = DAY_KEY.exec(dayKey);
  if (!match) {
    return null;
  }
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms;
}

function utcMsToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The day `delta` days after `dayKey` (calendar arithmetic, no time zones). */
export function shiftDay(dayKey: string, delta: number): string {
  const ms = dayToUtcMs(dayKey);
  return ms === null ? dayKey : utcMsToDay(ms + delta * DAY_MS);
}

/** UTC calendar day of a unix-seconds timestamp, or null when it is not one. */
export function utcDayOfEpoch(seconds: number): string | null {
  return Number.isFinite(seconds) && seconds > 0 ? utcMsToDay(seconds * 1000) : null;
}

/**
 * Turns the server's `by_day` buckets (newest first, days without usage
 * omitted) into `days` consecutive days, oldest first, with zeros filled in.
 *
 * The series ends on the UTC day of `rangeEndSeconds` — the server's default
 * SQLite ledger buckets by UTC day — or on the newest bucket when that is
 * later (a server bucketing in a zone ahead of UTC). The rolling windows
 * (`last_7d` = now − 7×24h) reach back into one extra calendar day, so the
 * series grows by that one day rather than dropping its usage.
 */
export function dailySeries(
  buckets: readonly ValueBucket[],
  days: number,
  rangeEndSeconds: number,
): DailyPoint[] {
  const byDay = new Map<string, number>();
  for (const bucket of buckets) {
    const match = DAY_KEY.exec(bucket.key);
    if (match && dayToUtcMs(bucket.key) !== null) {
      const key = match[0];
      byDay.set(key, (byDay.get(key) ?? 0) + bucket.total_tokens);
    }
  }

  if (byDay.size === 0 && buckets.length > 0) {
    // Keys in a format we do not know: show them as sent, oldest first.
    return buckets.map(bucket => ({ key: bucket.key, value: bucket.total_tokens })).reverse();
  }

  const keys = [...byDay.keys()].sort();
  const newest = keys.at(-1);
  const oldest = keys.at(0);
  // The range end is exclusive, so step back one second before taking its day.
  const rangeEndDay = utcDayOfEpoch(rangeEndSeconds - 1);
  const end =
    rangeEndDay !== null && newest !== undefined
      ? rangeEndDay > newest
        ? rangeEndDay
        : newest
      : (rangeEndDay ?? newest);
  if (end === undefined || days < 1) {
    return [];
  }

  let start = shiftDay(end, -(days - 1));
  if (oldest !== undefined && oldest < start) {
    start = shiftDay(start, -1);
  }

  const series: DailyPoint[] = [];
  // Bounded by `days + 1` slots, so a malformed key can never loop forever.
  for (let key = start; key <= end && series.length <= days; key = shiftDay(key, 1)) {
    series.push({ key, value: byDay.get(key) ?? 0 });
  }
  return series;
}

export interface RankedRow {
  key: string;
  label: string;
  value: number;
  /** Fraction of the total across all buckets (0–1). */
  share: number;
  /** Fraction of the largest row (0–1) — the length of its bar. */
  relative: number;
}

export interface RankedBuckets {
  rows: RankedRow[];
  /** Everything beyond `limit`, rolled into one figure. */
  rest: { count: number; value: number; share: number; relative: number } | null;
}

/** Largest buckets first, capped at `limit`, with the remainder summed. */
export function rankBuckets(buckets: readonly ValueBucket[], limit: number): RankedBuckets {
  const sorted = buckets
    .filter(bucket => bucket.total_tokens > 0)
    .sort((a, b) => b.total_tokens - a.total_tokens);
  const total = sorted.reduce((sum, bucket) => sum + bucket.total_tokens, 0);
  const largest = sorted.at(0)?.total_tokens ?? 0;
  const measure = (value: number) => ({
    share: total > 0 ? value / total : 0,
    relative: largest > 0 ? Math.min(1, value / largest) : 0,
  });

  const rows = sorted.slice(0, Math.max(0, limit)).map(bucket => ({
    key: bucket.key,
    label: bucket.label,
    value: bucket.total_tokens,
    ...measure(bucket.total_tokens),
  }));
  const remainder = sorted.slice(rows.length);
  const restValue = remainder.reduce((sum, bucket) => sum + bucket.total_tokens, 0);
  return {
    rows,
    rest:
      remainder.length > 0
        ? { count: remainder.length, value: restValue, ...measure(restValue) }
        : null,
  };
}
