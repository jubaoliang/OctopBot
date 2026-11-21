/** The slice of a calendar event the today card needs (structural, so the
 * util stays pure — the platform's CalendarEvent satisfies it). */
export interface TodayEvent {
  title: string;
  /** Epoch milliseconds. */
  start: number;
  end: number;
  allDay: boolean;
}

/**
 * The soonest event that has not ended yet — what "next on your schedule"
 * means at a glance. Events already over are skipped; an all-day event is
 * live until its end (midnight), so it surfaces on its day.
 */
export function nextEventToday<T extends TodayEvent>(events: T[], now: number): T | null {
  let best: T | null = null;
  for (const event of events) {
    if (event.end <= now) {
      continue;
    }
    if (best === null || event.start < best.start) {
      best = event;
    }
  }
  return best;
}

/** The event's start as a glanceable time label (or the all-day label). */
export function formatEventTime(event: TodayEvent, locale: string, allDayLabel: string): string {
  if (event.allDay) {
    return allDayLabel;
  }
  return new Date(event.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
