import { CRON_PRESETS, cronTrigger, isValidCronExpression } from '../cron-trigger';

describe('isValidCronExpression', () => {
  it('accepts the builder presets', () => {
    expect(isValidCronExpression('0 9 * * *')).toBe(true);
    expect(isValidCronExpression('0 18 * * 1-5')).toBe(true);
    expect(isValidCronExpression('0 10 * * 1')).toBe(true);
  });

  it('accepts steps, ranges and lists within bounds', () => {
    expect(isValidCronExpression('*/15 * * * *')).toBe(true);
    expect(isValidCronExpression('0 9-17 * * 1-5')).toBe(true);
    expect(isValidCronExpression('0,30 8 1,15 * *')).toBe(true);
    expect(isValidCronExpression('0 0 1 1 7')).toBe(true);
    expect(isValidCronExpression('  0 9 * * *  ')).toBe(true);
  });

  it('rejects wrong field counts and junk', () => {
    expect(isValidCronExpression('')).toBe(false);
    expect(isValidCronExpression('0 9 * *')).toBe(false);
    expect(isValidCronExpression('0 9 * * * *')).toBe(false);
    expect(isValidCronExpression('every day at nine')).toBe(false);
    expect(isValidCronExpression('0 9 * * MON')).toBe(false);
  });

  it('rejects out-of-bounds and inverted ranges', () => {
    expect(isValidCronExpression('60 9 * * *')).toBe(false);
    expect(isValidCronExpression('0 24 * * *')).toBe(false);
    expect(isValidCronExpression('0 9 0 * *')).toBe(false);
    expect(isValidCronExpression('0 9 * 13 *')).toBe(false);
    expect(isValidCronExpression('0 9 * * 8')).toBe(false);
    expect(isValidCronExpression('0 17-9 * * *')).toBe(false);
    expect(isValidCronExpression('*/0 * * * *')).toBe(false);
    expect(isValidCronExpression('0 9 * * 1-')).toBe(false);
  });
});

describe('cronTrigger', () => {
  it('wraps the expression as the server trigger', () => {
    expect(cronTrigger('0 9 * * *')).toBe('cron:0 9 * * *');
    expect(CRON_PRESETS.hourly).toBe('interval:3600');
  });
});
