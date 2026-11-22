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

/** Up to `limit` events that have not ended yet, soonest first. */
export function upcomingToday<T extends TodayEvent>(events: T[], now: number, limit: number): T[] {
  return events
    .filter(e => e.end > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, limit);
}

/** The slice of a cron job the today card needs (structural, pure). */
export interface TodayCron {
  name?: string | null;
  enabled: boolean;
  /** ISO timestamp of the next run, when scheduled. */
  next_run?: string | null;
  /** Owning expert's display name, for attribution. */
  agentName?: string;
}

/**
 * The soonest enabled routine that still has a future run — the next
 * proactive thing the assistant will do on the user's behalf.
 */
export function soonestCron<T extends TodayCron>(jobs: T[], now: number): T | null {
  let best: T | null = null;
  let bestTime = Infinity;
  for (const job of jobs) {
    if (!job.enabled || !job.next_run) {
      continue;
    }
    const time = Date.parse(job.next_run);
    if (Number.isNaN(time) || time <= now) {
      continue;
    }
    if (time < bestTime) {
      bestTime = time;
      best = job;
    }
  }
  return best;
}
