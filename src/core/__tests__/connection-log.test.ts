import {
  clearConnectionEvents,
  formatConnectionEvent,
  formatConnectionEvents,
  logConnection,
  recentConnectionEvents,
} from '../connection-log';

describe('connection log', () => {
  beforeEach(() => {
    clearConnectionEvents();
  });

  it('records transitions in order with their detail', () => {
    logConnection({ t: 1_000, socket: 'chat', status: 'open' });
    logConnection({ t: 2_000, socket: 'session', status: 'reconnecting', detail: 'close 1006' });
    expect(recentConnectionEvents().map(event => [event.socket, event.status])).toEqual([
      ['chat', 'open'],
      ['session', 'reconnecting'],
    ]);
    // Wall-clock rendering is local time; only the seconds are asserted.
    expect(formatConnectionEvent(recentConnectionEvents()[1])).toMatch(
      /^01-01 \d{2}:00:02\s+session\s+reconnecting\s+· close 1006$/,
    );
  });

  it('is bounded so a flapping socket cannot grow it without limit', () => {
    for (let index = 0; index < 80; index += 1) {
      logConnection({ t: index, socket: 'http', status: 'retry' });
    }
    const events = recentConnectionEvents();
    expect(events).toHaveLength(60);
    expect(events[0].t).toBe(20);
    expect(events.at(-1)?.t).toBe(79);
  });

  it('formats a copyable block and empties on clear', () => {
    logConnection({ t: 0, socket: 'session', status: 'closed' });
    logConnection({ t: 0, socket: 'http', status: 'error', detail: 'GET /api/agents · timed out' });
    const text = formatConnectionEvents();
    expect(text.split('\n')).toHaveLength(2);
    expect(text).toContain('http');
    expect(text).not.toContain('{');
    clearConnectionEvents();
    expect(formatConnectionEvents()).toBe('');
  });
});
