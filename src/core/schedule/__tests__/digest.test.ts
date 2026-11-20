import { buildScheduleDigest, type DigestEvent } from '../digest';

// Fixed "now": Wed 2026-03-04 10:30 local.
const NOW = new Date(2026, 2, 4, 10, 30);

function event(partial: Partial<DigestEvent> & { id: string; start: number }): DigestEvent {
  return {
    title: 'Event',
    end: partial.start + 3_600_000,
    allDay: false,
    location: null,
    ...partial,
  };
}

function at(day: number, hour: number): number {
  return new Date(2026, 2, day, hour).getTime();
}

describe('buildScheduleDigest', () => {
  it('returns null when nothing falls inside the window', () => {
    const events = [event({ id: 'e1', start: at(20, 9) })];
    expect(buildScheduleDigest(events, NOW)).toBeNull();
  });

  it('groups events by local day with today/tomorrow headings', () => {
    const events = [
      event({ id: 'e2', start: at(5, 9), title: 'Later', location: 'Offsite' }),
      event({ id: 'e1', start: at(4, 14), title: 'First' }),
    ];
    const digest = buildScheduleDigest(events, NOW);
    expect(digest).toContain('# My schedule (next 7 days, device-local time)');
    expect(digest).toContain('### Wed 03-04 (today)');
    expect(digest).toContain('- 14:00–15:00 First');
    expect(digest).toContain('### Thu 03-05 (tomorrow)');
    expect(digest).toContain('- 09:00–10:00 Later — Offsite');
  });

  it('marks all-day events and omits empty locations', () => {
    const events = [
      event({ id: 'e1', start: at(4, 0), end: at(5, 0), allDay: true, title: 'Off' }),
    ];
    const digest = buildScheduleDigest(events, NOW);
    expect(digest).toContain('- all-day Off');
    expect(digest).not.toContain('—');
  });

  it('sorts within a day and stamps the generation time', () => {
    const events = [
      event({ id: 'e2', start: at(4, 18), title: 'Second' }),
      event({ id: 'e1', start: at(4, 14), title: 'First' }),
    ];
    const digest = buildScheduleDigest(events, NOW) ?? '';
    const firstIndex = digest.indexOf('14:00');
    const secondIndex = digest.indexOf('18:00');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(digest).toMatch(/_Generated 2026-03-04 10:30 from the device calendar\._$/);
  });

  it('drops events that already ended', () => {
    const events = [
      event({ id: 'e1', start: at(4, 8), end: at(4, 9), title: 'Past' }),
      event({ id: 'e2', start: at(4, 12), title: 'Upcoming' }),
    ];
    const digest = buildScheduleDigest(events, NOW);
    expect(digest).not.toContain('Past');
    expect(digest).toContain('Upcoming');
  });
});
