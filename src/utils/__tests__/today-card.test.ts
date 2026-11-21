import { formatEventTime, nextEventToday, type TodayEvent } from '../today-card';

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
