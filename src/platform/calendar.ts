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
 * Best-effort everywhere: a denied permission or a device without a
 * calendar provider degrades to "no events" — nothing may throw into the
 * UI (haptics.ts run() pattern).
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
    try {
      const calendars = await ExpoCalendar.getCalendars(ExpoCalendar.EntityTypes.EVENT);
      return calendars.map(calendar => ({
        id: calendar.id,
        title: calendar.title,
        source: calendar.source?.name ?? null,
        allowsWrites: calendar.allowsModifications,
      }));
    } catch {
      return [];
    }
  },
  listEvents: async (calendarIds, start, end) => {
    if (calendarIds.length === 0) {
      return [];
    }
    try {
      const events = await ExpoCalendar.listEvents(calendarIds, start, end);
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
    } catch {
      return [];
    }
  },
};

export const calendarReader: CalendarReader = supported ? expoReader : noopReader;
