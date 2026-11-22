/**
 * Rolling schedule digest — the pure markdown the calendar sync writes into
 * the agent's knowledge base. Server-side turns (7am cron, proactive care,
 * chat) find this document via `search_knowledge` and answer schedule
 * questions without any device access.
 *
 * Deliberately minimal: titles, times, locations. No attendee data, no
 * notes — the digest is the least of the calendar that makes the assistant
 * schedule-aware.
 */

import { safeLine } from '../markdown-safe';

export interface DigestEvent {
  id: string;
  title: string;
  /** Epoch milliseconds. */
  start: number;
  end: number;
  allDay: boolean;
  location: string | null;
}

export const DIGEST_DAYS = 7;

/** Local date key `YYYY-MM-DD` — days group in the device's timezone. */
function dayKey(epochMs: number): string {
  const date = new Date(epochMs);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function relativeSuffix(delta: number): string {
  if (delta === 0) {
    return ' (today)';
  }
  if (delta === 1) {
    return ' (tomorrow)';
  }
  return '';
}

function dayHeading(epochMs: number, now: Date): string {
  const date = new Date(epochMs);
  const todayKey = dayKey(now.getTime());
  const key = dayKey(epochMs);
  const delta = Math.round(
    (new Date(`${key}T12:00:00`).getTime() - new Date(`${todayKey}T12:00:00`).getTime()) /
      86_400_000,
  );
  const relative = relativeSuffix(delta);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${WEEKDAY[date.getDay()]} ${month}-${day}${relative}`;
}

function timeOfDay(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** One-line markdown-safe text for device-sourced strings. */
function eventLine(event: DigestEvent): string {
  const time = event.allDay ? 'all-day' : `${timeOfDay(event.start)}–${timeOfDay(event.end)}`;
  const location = event.location ? ` — ${safeLine(event.location)}` : '';
  return `- ${time} ${safeLine(event.title)}${location}`;
}

/**
 * Markdown for the events within `days` of `now` (device-local days).
 * Returns `null` when nothing falls in the window — callers keep the
 * previous digest instead of wiping it.
 */
export function buildScheduleDigest(
  events: DigestEvent[],
  now: Date = new Date(),
  days: number = DIGEST_DAYS,
): string | null {
  const windowEnd = now.getTime() + days * 86_400_000;
  const inWindow = events
    .filter(event => event.end >= now.getTime() && event.start < windowEnd)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (inWindow.length === 0) {
    return null;
  }
  const sections: string[] = [];
  let currentDay = '';
  for (const event of inWindow) {
    const key = dayKey(event.start);
    if (key !== currentDay) {
      currentDay = key;
      sections.push(`### ${dayHeading(event.start, now)}`);
    }
    sections.push(eventLine(event));
  }
  const generated = timeOfDay(now.getTime());
  const stamp = `${dayKey(now.getTime())} ${generated}`;
  return [
    `# My schedule (next ${days} days, device-local time)`,
    ...sections,
    '',
    `_Generated ${stamp} from the device calendar._`,
  ].join('\n');
}

/**
 * Truthful digest for a successfully-read but empty calendar. Unlike the
 * `null` from buildScheduleDigest (which means "keep the previous digest"),
 * this is written on a confirmed empty read so an empty calendar still counts
 * as a successful sync and the server sees "no events", not stale ones.
 */
export function emptyScheduleDigest(now: Date = new Date(), days: number = DIGEST_DAYS): string {
  const stamp = `${dayKey(now.getTime())} ${timeOfDay(now.getTime())}`;
  return [
    `# My schedule (next ${days} days, device-local time)`,
    '',
    `_No events in the next ${days} days._`,
    '',
    `_Generated ${stamp} from the device calendar._`,
  ].join('\n');
}
