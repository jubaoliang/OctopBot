import { createContext, useContext } from 'react';

import type { CalendarPermissionState, DeviceCalendar } from '@/platform/calendar';
import type { ContactsPermissionState } from '@/platform/contacts';
import type { TelephonyPermissionState } from '@/platform/telephony';

/**
 * Isolated from `calendar-sync.tsx` so Fast Refresh of provider logic does
 * not recreate the context object (which would make consumers see `null`).
 */

/** Per-capability opt-in for exposing device tools to experts. */
export interface DeviceConsent {
  calendar: boolean;
  contacts: boolean;
  actions: boolean;
  sms: boolean;
}

export interface CalendarSyncValue {
  consent: DeviceConsent;
  setConsent: (patch: Partial<DeviceConsent>) => void;
  permission: CalendarPermissionState;
  contactsPermission: ContactsPermissionState;
  smsPermission: TelephonyPermissionState;
  refreshPermission: () => Promise<void>;
  requestCalendarPermissions: () => Promise<CalendarPermissionState>;
  requestContactsPermissions: () => Promise<ContactsPermissionState>;
  requestSmsPermissions: () => Promise<TelephonyPermissionState>;
  /** Device calendars holding events (loaded when permission is granted). */
  calendars: DeviceCalendar[];
}

export const CalendarSyncContext = createContext<CalendarSyncValue | null>(null);

export function useCalendarSync(): CalendarSyncValue {
  const value = useContext(CalendarSyncContext);
  if (!value) {
    throw new Error('useCalendarSync must be used inside CalendarSyncProvider');
  }
  return value;
}
