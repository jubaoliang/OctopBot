/**
 * Human-readable approval-card copy for device tool calls. The card must
 * read like a sentence ("Send SMS to 10086" + the full message), never a
 * JSON dump of the tool input. Pure TypeScript; i18n templates come from
 * `strings.deviceTools.card`.
 */

import type { DeviceToolName } from './device-tools';

export interface DeviceToolCardCopy {
  call: string;
  dial: string;
  smsSend: string;
  smsCompose: string;
  mail: string;
  createEvent: string;
  updateEvent: string;
  deleteEvent: string;
  readCalendar: string;
  searchContacts: string;
  readSms: string;
  body: string;
  subject: string;
  time: string;
  location: string;
  notes: string;
  changes: string;
  query: string;
  days: string;
  limit: string;
  allDay: string;
}

export interface DeviceToolCardText {
  summary: string;
  detail?: string;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '');
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function str(rec: Record<string, unknown>, key: string): string | null {
  const value = rec[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function num(rec: Record<string, unknown>, key: string): number | null {
  const value = rec[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Local wall-clock rendering; no Intl dependency (Hermes-safe). */
function localParts(iso: string): { date: string; clock: string } | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    clock: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

function timeRange(rec: Record<string, unknown>): string | null {
  const start = str(rec, 'start');
  if (!start) {
    return null;
  }
  const from = localParts(start);
  if (!from) {
    return null;
  }
  if (rec.allDay === true) {
    return from.date;
  }
  const end = str(rec, 'end');
  const to = end ? localParts(end) : null;
  if (!to) {
    return `${from.date} ${from.clock}`;
  }
  return to.date === from.date
    ? `${from.date} ${from.clock}–${to.clock}`
    : `${from.date} ${from.clock} → ${to.date} ${to.clock}`;
}

export function formatDeviceToolCall(
  name: DeviceToolName,
  input: unknown,
  copy: DeviceToolCardCopy,
): DeviceToolCardText {
  const rec = asRecord(input);
  const lines: string[] = [];
  const number = str(rec, 'number') ?? '';
  let summary: string;

  switch (name) {
    case 'phone.call':
      summary = fill(copy.call, { number });
      break;
    case 'phone.dial':
      summary = fill(copy.dial, { number });
      break;
    case 'sms.send':
    case 'sms.compose': {
      summary = fill(name === 'sms.send' ? copy.smsSend : copy.smsCompose, { number });
      const body = str(rec, 'body');
      if (body) {
        lines.push(fill(copy.body, { body }));
      }
      break;
    }
    case 'mail.compose': {
      summary = fill(copy.mail, { to: str(rec, 'to') ?? '' });
      const subject = str(rec, 'subject');
      if (subject) {
        lines.push(fill(copy.subject, { subject }));
      }
      const body = str(rec, 'body');
      if (body) {
        lines.push(fill(copy.body, { body }));
      }
      break;
    }
    case 'calendar.create_event': {
      summary = fill(copy.createEvent, { title: str(rec, 'title') ?? '' });
      const range = timeRange(rec);
      if (range) {
        lines.push(
          fill(copy.time, { range: rec.allDay === true ? `${range} (${copy.allDay})` : range }),
        );
      }
      const location = str(rec, 'location');
      if (location) {
        lines.push(fill(copy.location, { location }));
      }
      const notes = str(rec, 'notes');
      if (notes) {
        lines.push(fill(copy.notes, { notes }));
      }
      break;
    }
    case 'calendar.update_event': {
      summary = fill(copy.updateEvent, { id: str(rec, 'id') ?? '' });
      const changes: string[] = [];
      const title = str(rec, 'title');
      if (title) {
        changes.push(title);
      }
      const range = timeRange(rec);
      if (range) {
        changes.push(range);
      }
      const location = str(rec, 'location');
      if (location) {
        changes.push(fill(copy.location, { location }));
      }
      const notes = str(rec, 'notes');
      if (notes) {
        changes.push(fill(copy.notes, { notes }));
      }
      if (changes.length > 0) {
        lines.push(fill(copy.changes, { changes: changes.join(' · ') }));
      }
      break;
    }
    case 'calendar.delete_event':
      summary = fill(copy.deleteEvent, { id: str(rec, 'id') ?? '' });
      break;
    case 'calendar.list_events':
      summary = copy.readCalendar;
      lines.push(fill(copy.days, { days: String(num(rec, 'days') ?? 7) }));
      break;
    case 'contacts.search': {
      summary = copy.searchContacts;
      const query = str(rec, 'query');
      if (query) {
        lines.push(fill(copy.query, { query }));
      }
      break;
    }
    case 'sms.read': {
      summary = copy.readSms;
      const query = str(rec, 'query');
      if (query) {
        lines.push(fill(copy.query, { query }));
      }
      lines.push(fill(copy.limit, { limit: String(num(rec, 'limit') ?? 20) }));
      break;
    }
  }

  return { summary, detail: lines.length > 0 ? lines.join('\n') : undefined };
}
