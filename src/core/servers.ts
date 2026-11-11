/**
 * Multi-server history — pure logic, storage-agnostic.
 *
 * The active server URL stays in its own key (existing session code reads
 * it); the history array is the pick list shown on the login sheet.
 */

export interface ServerEntry {
  url: string;
  /** Optional label shown in the picker ("家", "公司"…). */
  label?: string;
  lastUsed: number;
}

export const MAX_SERVERS = 5;

export function parseServerList(raw: string | null): ServerEntry[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (e): e is ServerEntry =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as ServerEntry).url === 'string' &&
          typeof (e as ServerEntry).lastUsed === 'number',
      )
      .slice(0, MAX_SERVERS);
  } catch {
    return [];
  }
}

export function serializeServerList(list: ServerEntry[]): string {
  return JSON.stringify(list.slice(0, MAX_SERVERS));
}

/** Upsert by URL (normalized by the caller), touch lastUsed, cap the list. */
export function upsertServer(
  list: ServerEntry[],
  url: string,
  label?: string,
  now = Date.now(),
): ServerEntry[] {
  const rest = list.filter(e => e.url !== url);
  const existing = list.find(e => e.url === url);
  const entry: ServerEntry = {
    url,
    label: label ?? existing?.label,
    lastUsed: now,
  };
  return [entry, ...rest].slice(0, MAX_SERVERS);
}

export function removeServer(list: ServerEntry[], url: string): ServerEntry[] {
  return list.filter(e => e.url !== url);
}
