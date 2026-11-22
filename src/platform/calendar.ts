import * as ExpoCalendar from 'expo-calendar';
import { Platform } from 'react-native';

/**
 * Platform calendar reader — the ONLY place expo-calendar is imported
 * (AGENTS.md wrapper hygiene; a HarmonyOS shim swaps this module).
 *
 * Read-only: the assistant consumes the device schedule; it never writes
 * events. SDK 58 renamed the API — legacy `getEventsAsync`-style methods
 * throw at runtime, everything here uses the new names.
 *
 * Best-effort permissions: a denied permission or a device without a
 * calendar provider degrades to "denied". Reads (getReadableCalendars /
 * listEvents) PROPAGATE errors so callers can tell a failed read from a
 * genuinely empty calendar — an empty calendar is a valid sync result, a
 * failed read is not. Callers catch; nothing throws into the UI.
 */

export type CalendarPermissionState = 'granted' | 'denied' | 'undetermined';

export interface DeviceCalendar {
  id: string;
  title: string;
  /** The OS account the calendar belongs to (e.g. an email address). */
  source: string | null;
  allowsWrites: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** Epoch milliseconds. */
  start: number;
  end: number;
  allDay: boolean;
  location: string | null;
}

export interface CalendarReader {
  getPermissionStatus: () => Promise<CalendarPermissionState>;
  requestPermissions: () => Promise<CalendarPermissionState>;
  /** Calendars that hold schedulable events (EntityTypes.EVENT). */
  getReadableCalendars: () => Promise<DeviceCalendar[]>;
  listEvents: (calendarIds: string[], start: Date, end: Date) => Promise<CalendarEvent[]>;
  /** Creates an event on the first writable calendar; throws when none. */
  createEvent: (input: {
    title: string;
    start: string;
    end?: string;
    allDay?: boolean;
    location?: string;
    notes?: string;
  }) => Promise<{ id: string }>;
}

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function toState(response: { status?: string; granted?: boolean }): CalendarPermissionState {
  if (response.granted) {
    return 'granted';
  }
  if (response.status === 'denied') {
    return 'denied';
  }
  return 'undetermined';
}

const noopReader: CalendarReader = {
  getPermissionStatus: async () => 'denied',
  requestPermissions: async () => 'denied',
  getReadableCalendars: async () => [],
  listEvents: async () => [],
  createEvent: async () => {
    throw new Error('calendar unsupported on this platform');
  },
};

const expoReader: CalendarReader = {
  getPermissionStatus: async () => {
    try {
      return toState(await ExpoCalendar.getCalendarPermissions());
    } catch {
      return 'denied';
    }
  },
  requestPermissions: async () => {
    try {
      return toState(await ExpoCalendar.requestCalendarPermissions());
    } catch {
      return 'denied';
    }
  },
  getReadableCalendars: async () => {
    const calendars = await ExpoCalendar.getCalendars(ExpoCalendar.EntityTypes.EVENT);
    return calendars.map(calendar => ({
      id: calendar.id,
      title: calendar.title,
      source: calendar.source?.name ?? null,
      allowsWrites: calendar.allowsModifications,
    }));
  },
  listEvents: async (calendarIds, start, end) => {
    if (calendarIds.length === 0) {
      return [];
    }
    // SDK 58 on Android collapses Date objects to epoch 0 across the bridge
    // (both read window and write dates); ISO strings are the only reliable
    // wire form even though the SDK typings still say Date.
    const iso = (value: Date) => value.toISOString() as unknown as Date;
    const calendars = await ExpoCalendar.getCalendars(ExpoCalendar.EntityTypes.EVENT);
    const wanted = calendars.filter(calendar => calendarIds.includes(calendar.id));
    const pages = await Promise.all(
      wanted.map(calendar => calendar.listEvents(iso(start), iso(end))),
    );
    const events = pages.flat();
    return events
      .map(event => ({
        id: event.id,
        title: event.title,
        start: new Date(event.startDate).getTime(),
        end: new Date(event.endDate).getTime(),
        allDay: event.allDay,
        location: event.location,
      }))
      .filter(event => Number.isFinite(event.start) && Number.isFinite(event.end))
      .sort((a, b) => a.start - b.start);
  },
  createEvent: async input => {
    const calendars = await ExpoCalendar.getCalendars(ExpoCalendar.EntityTypes.EVENT);
    // Android reads query the Instances table, which excludes hidden
    // calendars; writing into a hidden local account would make the event
    // invisible to every later read. Prefer a visible writable calendar.
    const target =
      calendars.find(calendar => calendar.allowsModifications && calendar.isVisible !== false) ??
      calendars.find(calendar => calendar.allowsModifications);
    if (!target) {
      throw new Error('no writable calendar on this device');
    }
    const start = new Date(input.start);
    const end = input.end ? new Date(input.end) : new Date(start.getTime() + 3_600_000);
    // SDK 58 Android collapses Date objects to epoch 0 in createEvent; ISO
    // strings are the only reliable wire form for the write path.
    const created = await target.createEvent({
      title: input.title,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      allDay: input.allDay ?? false,
      location: input.location ?? '',
      notes: input.notes ?? '',
    });
    return { id: created.id };
  },
};

export const calendarReader: CalendarReader = supported ? expoReader : noopReader;
