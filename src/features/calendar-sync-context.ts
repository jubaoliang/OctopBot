import { createContext, useContext } from 'react';

import type { CalendarPermissionState, DeviceCalendar } from '@/platform/calendar';
import type { ContactsPermissionState } from '@/platform/contacts';

/**
 * Isolated from `calendar-sync.tsx` so Fast Refresh of provider logic does
 * not recreate the context object (which would make consumers see `null`).
 */

export interface CalendarSyncValue {
  /**
   * Master switch (persisted). When true, the app keeps the rolling digest
   * document in the agent's knowledge base and attaches that KB to chat
   * turns so the assistant is schedule-aware.
   */
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  permission: CalendarPermissionState;
  refreshPermission: () => Promise<void>;
  requestPermissions: () => Promise<CalendarPermissionState>;
  /** Device calendars holding events (loaded when permission is granted). */
  calendars: DeviceCalendar[];
  /** Selected calendar ids (persisted); empty = nothing synced yet. */
  selectedIds: string[];
  toggleCalendar: (id: string) => void;
  /** The knowledge base carrying the schedule digest (persisted). */
  kbId: string | null;
  /** Epoch ms of the last successful sync, or null. */
  lastSyncAt: number | null;
  syncing: boolean;
  /** Syncs every enabled capability now (schedule, contacts). */
  syncNow: () => Promise<void>;
  /** Contacts capability: opt-in digest of the address book. */
  contactsEnabled: boolean;
  setContactsEnabled: (next: boolean) => void;
  contactsPermission: ContactsPermissionState;
  requestContactsPermissions: () => Promise<ContactsPermissionState>;
  contactsKbId: string | null;
}

export const CalendarSyncContext = createContext<CalendarSyncValue | null>(null);

export function useCalendarSync(): CalendarSyncValue {
  const value = useContext(CalendarSyncContext);
  if (!value) {
    throw new Error('useCalendarSync must be used inside CalendarSyncProvider');
  }
  return value;
}
