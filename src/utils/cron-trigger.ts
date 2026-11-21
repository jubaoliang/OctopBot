/**
 * Cron trigger helpers for the routine builder. The server accepts
 * `cron:<5-field expr>`, `interval:<seconds>`, `date:…` and `agently:…`;
 * the builder emits the first two and validates custom expressions before
 * they leave the device (the server validates again).
 */

export const CRON_PRESETS = {
  daily: 'cron:0 9 * * *',
  weekdays: 'cron:0 18 * * 1-5',
  weekly: 'cron:0 10 * * 1',
  hourly: 'interval:3600',
  briefingMorning: 'cron:0 9 * * *',
  briefingEvening: 'cron:0 21 * * *',
} as const;

/** The schedule presets the builder offers as chips (briefing triggers are
 * referenced directly, not chosen as a generic preset). */
export type CronPresetId = 'daily' | 'weekdays' | 'weekly' | 'hourly';

/** Field bounds: minute, hour, day-of-month, month, day-of-week (0 and 7 = Sun). */
const FIELD_BOUNDS: readonly (readonly [number, number])[] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];

function validField(field: string, min: number, max: number): boolean {
  // Lists split first: "1,15" / "MON,WED" names are not supported (numeric only).
  for (const part of field.split(',')) {
    const [range, step, ...extra] = part.split('/');
    if (extra.length > 0 || range.length === 0) {
      return false;
    }
    if (step !== undefined) {
      if (!/^\d+$/.test(step) || Number(step) === 0) {
        return false;
      }
    }
    if (range === '*') {
      continue;
    }
    const [lo, hi, ...rest] = range.split('-');
    if (rest.length > 0) {
      return false;
    }
    if (!/^\d+$/.test(lo)) {
      return false;
    }
    const loNum = Number(lo);
    const hiNum = hi === undefined ? loNum : Number(hi);
    if (hi !== undefined && !/^\d+$/.test(hi)) {
      return false;
    }
    if (loNum < min || hiNum > max || loNum > hiNum) {
      return false;
    }
  }
  return true;
}

/** True for a syntactically valid 5-field numeric cron expression. */
export function isValidCronExpression(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5 || fields.some(f => f.length === 0)) {
    return false;
  }
  return fields.every((field, i) => validField(field, FIELD_BOUNDS[i][0], FIELD_BOUNDS[i][1]));
}

/** Wrap a validated expression as the server's cron trigger. */
export function cronTrigger(expr: string): string {
  return `cron:${expr.trim()}`;
}
