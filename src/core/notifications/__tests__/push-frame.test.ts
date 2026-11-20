import { parseDashboardPush } from '../push-frame';

describe('parseDashboardPush', () => {
  it('parses a complete dashboard_push frame', () => {
    expect(
      parseDashboardPush({
        type: 'dashboard_push',
        agent_id: 'main',
        thread_id: 't-1',
        text: 'Daily digest is ready',
        agent_name: 'Assistant',
      }),
    ).toEqual({
      type: 'dashboard_push',
      agent_id: 'main',
      thread_id: 't-1',
      text: 'Daily digest is ready',
      agent_name: 'Assistant',
    });
  });

  it('normalizes optional fields to null', () => {
    const push = parseDashboardPush({
      type: 'dashboard_push',
      agent_id: 'main',
      thread_id: 42,
      text: 'Reminder',
      agent_name: 7,
    });
    expect(push).toEqual({
      type: 'dashboard_push',
      agent_id: 'main',
      thread_id: null,
      text: 'Reminder',
      agent_name: null,
    });
  });

  it('rejects non-push and malformed frames', () => {
    expect(parseDashboardPush({ type: 'pong' })).toBeNull();
    expect(parseDashboardPush({ type: 'dashboard_push', agent_id: '', text: 'x' })).toBeNull();
    expect(parseDashboardPush({ type: 'dashboard_push', agent_id: 'main' })).toBeNull();
    expect(parseDashboardPush({ type: 'dashboard_push', text: 'x' })).toBeNull();
    expect(parseDashboardPush(null)).toBeNull();
    expect(parseDashboardPush(undefined)).toBeNull();
    expect(parseDashboardPush('dashboard_push')).toBeNull();
  });
});
