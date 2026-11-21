/** Structural slice of the drawer's task groups — keeps the count pure. */
interface UnreadGroup {
  items: { unreadCount: number }[];
}

/** Number of threads carrying unread replies, across all expert groups. */
export function countUnreadThreads(groups: UnreadGroup[]): number {
  return groups.reduce(
    (sum, group) => sum + group.items.filter(item => item.unreadCount > 0).length,
    0,
  );
}
