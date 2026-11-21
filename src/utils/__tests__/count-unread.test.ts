import { countUnreadThreads } from '../count-unread';

describe('countUnreadThreads', () => {
  it('counts threads with unread replies, not messages', () => {
    const groups = [
      { items: [{ unreadCount: 3 }, { unreadCount: 0 }, { unreadCount: 1 }] },
      { items: [{ unreadCount: 0 }] },
    ];
    expect(countUnreadThreads(groups)).toBe(2);
  });

  it('returns zero for empty or all-read groups', () => {
    expect(countUnreadThreads([])).toBe(0);
    expect(countUnreadThreads([{ items: [] }, { items: [{ unreadCount: 0 }] }])).toBe(0);
  });
});
