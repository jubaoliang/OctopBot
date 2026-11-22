import {
  formatEventTime,
  nextEventToday,
  soonestCron,
  upcomingToday,
  type TodayCron,
  type TodayEvent,
} from '../today-card';

function event(overrides: Partial<TodayEvent> & { title: string }): TodayEvent {
  return { start: 0, end: 60_000, allDay: false, ...overrides };
}

const NOW = 1_000_000;

describe('nextEventToday', () => {
  it('returns null for an empty list', () => {
    expect(nextEventToday([], NOW)).toBeNull();
  });

  it('skips events that have already ended', () => {
    const events = [
      event({ title: 'done', start: NOW - 120_000, end: NOW - 60_000 }),
      event({ title: 'ending now', start: NOW - 60_000, end: NOW }),
    ];
    expect(nextEventToday(events, NOW)).toBeNull();
  });

  it('picks the soonest live event, not the first in list order', () => {
    const later = event({ title: 'later', start: NOW + 120_000, end: NOW + 180_000 });
    const sooner = event({ title: 'sooner', start: NOW + 60_000, end: NOW + 120_000 });
    expect(nextEventToday([later, sooner], NOW)).toBe(sooner);
  });

  it('keeps an in-progress event (started, not ended)', () => {
    const live = event({ title: 'live', start: NOW - 60_000, end: NOW + 60_000 });
    expect(nextEventToday([live], NOW)).toBe(live);
  });

  it('surfaces an all-day event on its day', () => {
    const allDay = event({
      title: 'holiday',
      start: NOW - 3_600_000,
      end: NOW + 3_600_000,
      allDay: true,
    });
    expect(nextEventToday([allDay], NOW)).toBe(allDay);
  });
});

describe('formatEventTime', () => {
  it('uses the all-day label for all-day events', () => {
    const allDay = event({ title: 'holiday', allDay: true });
    expect(formatEventTime(allDay, 'en', 'All day')).toBe('All day');
  });

  it('formats a timed event start for the locale', () => {
    // 2026-01-01T09:05:00Z — locale-formatted, so assert on the minutes.
    const timed = event({ title: 'standup', start: Date.UTC(2026, 0, 1, 9, 5) });
    expect(formatEventTime(timed, 'en', 'All day')).toMatch(/05/);
  });
});

describe('upcomingToday', () => {
  const now = 1_000_000;
  it('returns soonest-first, capped, skipping ended events', () => {
    const a = event({ title: 'a', start: now + 3000, end: now + 9000 });
    const b = event({ title: 'b', start: now + 1000, end: now + 5000 });
    const done = event({ title: 'done', start: now - 5000, end: now - 1000 });
    const c = event({ title: 'c', start: now + 2000, end: now + 8000 });
    expect(upcomingToday([a, done, b, c], now, 2).map(e => e.title)).toEqual(['b', 'c']);
  });
  it('returns empty when nothing is upcoming', () => {
    expect(upcomingToday([event({ title: 'x', start: now - 10, end: now - 1 })], now, 3)).toEqual(
      [],
    );
  });
});

describe('soonestCron', () => {
  const now = Date.UTC(2026, 0, 1, 8, 0);
  const job = (over: Partial<TodayCron>): TodayCron => ({
    enabled: true,
    next_run: new Date(now + 3_600_000).toISOString(),
    ...over,
  });
  it('picks the soonest enabled future run', () => {
    const later = job({ name: 'later', next_run: new Date(now + 7_200_000).toISOString() });
    const sooner = job({ name: 'sooner', next_run: new Date(now + 1_800_000).toISOString() });
    expect(soonestCron([later, sooner], now)?.name).toBe('sooner');
  });
  it('skips disabled, past and unscheduled jobs', () => {
    const disabled = job({ name: 'off', enabled: false });
    const past = job({ name: 'past', next_run: new Date(now - 1000).toISOString() });
    const unscheduled = job({ name: 'none', next_run: null });
    expect(soonestCron([disabled, past, unscheduled], now)).toBeNull();
  });
});
