/**
 * Bounded in-memory record of connection transitions so a field report
 * ("it keeps disconnecting") can be answered with evidence instead of a
 * guess: which socket, when, which status, and the close code or reason
 * when the platform supplies one. Pure TS; nothing here leaves the device
 * unless the user copies it out of the diagnostics screen. No message
 * content, tokens, or server URLs are ever recorded.
 */

export type ConnectionSocket = 'chat' | 'notifications' | 'devices' | 'http';

export interface ConnectionEvent {
  /** Epoch milliseconds. */
  t: number;
  socket: ConnectionSocket;
  status: string;
  detail?: string;
}

const MAX_EVENTS = 60;
let events: ConnectionEvent[] = [];

export function logConnection(event: Omit<ConnectionEvent, 't'> & { t?: number }): void {
  events = [
    ...events,
    { t: event.t ?? Date.now(), socket: event.socket, status: event.status, detail: event.detail },
  ];
  if (events.length > MAX_EVENTS) {
    events = events.slice(events.length - MAX_EVENTS);
  }
}

/** Newest last, as recorded. */
export function recentConnectionEvents(): readonly ConnectionEvent[] {
  return events;
}

export function clearConnectionEvents(): void {
  events = [];
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Local wall-clock `MM-DD HH:MM:SS`; no Intl dependency (Hermes-safe). */
export function formatConnectionTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatConnectionEvent(event: ConnectionEvent): string {
  const parts = [formatConnectionTime(event.t), event.socket.padEnd(13), event.status];
  if (event.detail) {
    parts.push(`· ${event.detail}`);
  }
  return parts.join('  ');
}

/** Plain-text block for the clipboard, newest last. */
export function formatConnectionEvents(list: readonly ConnectionEvent[] = events): string {
  if (list.length === 0) {
    return '';
  }
  return list.map(formatConnectionEvent).join('\n');
}
