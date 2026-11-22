import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { calendarReader, type DeviceCalendar } from '@/platform/calendar';
import { contactsReader, type ContactsPermissionState } from '@/platform/contacts';
import type { SecureStorage } from '@/platform/secure-storage';

import {
  CalendarSyncContext,
  type CalendarSyncValue,
  type DeviceConsent,
} from '@/features/calendar-sync-context';

const CALENDAR_KEY = 'calendar.enabled';
const CONTACTS_KEY = 'contacts.enabled';
const ACTIONS_KEY = 'actions.enabled';

/**
 * Device-capability consent. The Connect switches decide which device tools
 * the app registers for an expert session; nothing is synced or uploaded.
 * Reads happen on demand when the expert calls a tool, writes/actions are
 * confirmed in conversation, and dial/compose hand off to the OS.
 */
export function CalendarSyncProvider({
  storage,
  children,
}: {
  storage: SecureStorage;
  children: ReactNode;
}) {
  const [consent, setConsentState] = useState<DeviceConsent>({
    calendar: false,
    contacts: false,
    actions: true,
  });
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );
  const [contactsPermission, setContactsPermission] =
    useState<ContactsPermissionState>('undetermined');
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);

  // Hydrate persisted consent once per mount.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      storage.get(CALENDAR_KEY),
      storage.get(CONTACTS_KEY),
      storage.get(ACTIONS_KEY),
    ])
      .then(([calendarValue, contactsValue, actionsValue]) => {
        if (cancelled) {
          return;
        }
        setConsentState({
          calendar: calendarValue === 'true',
          contacts: contactsValue === 'true',
          actions: actionsValue !== 'false',
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const refreshPermission = useCallback(async () => {
    const [calendarState, contactsState] = await Promise.all([
      calendarReader.getPermissionStatus(),
      contactsReader.getPermissionStatus(),
    ]);
    setPermission(calendarState);
    setContactsPermission(contactsState);
  }, []);

  const requestCalendarPermissions = useCallback(
    () =>
      calendarReader.requestPermissions().then(state => {
        setPermission(state);
        return state;
      }),
    [],
  );

  const requestContactsPermissions = useCallback(
    () =>
      contactsReader.requestPermissions().then(state => {
        setContactsPermission(state);
        return state;
      }),
    [],
  );

  // Load the device calendar list whenever permission becomes granted.
  useEffect(() => {
    if (permission !== 'granted') {
      let cancelled = false;
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setCalendars([]);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    void calendarReader
      .getReadableCalendars()
      .then(list => {
        if (!cancelled) {
          setCalendars(list);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCalendars([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [permission]);

  const setConsent = useCallback(
    (patch: Partial<DeviceConsent>) => {
      setConsentState(prev => {
        const next = { ...prev, ...patch };
        if (patch.calendar !== undefined) {
          void storage.set(CALENDAR_KEY, String(next.calendar)).catch(() => undefined);
        }
        if (patch.contacts !== undefined) {
          void storage.set(CONTACTS_KEY, String(next.contacts)).catch(() => undefined);
        }
        if (patch.actions !== undefined) {
          void storage.set(ACTIONS_KEY, String(next.actions)).catch(() => undefined);
        }
        return next;
      });
      if (patch.calendar === true) {
        void requestCalendarPermissions();
      }
      if (patch.contacts === true) {
        void requestContactsPermissions();
      }
    },
    [storage, requestCalendarPermissions, requestContactsPermissions],
  );

  // App resume: permissions can change in OS Settings while we're backgrounded.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refreshPermission();
      }
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  useEffect(() => {
    void Promise.resolve().then(() => refreshPermission());
  }, [refreshPermission]);

  const value = useMemo<CalendarSyncValue>(
    () => ({
      consent,
      setConsent,
      permission,
      contactsPermission,
      refreshPermission,
      requestCalendarPermissions,
      requestContactsPermissions,
      calendars,
    }),
    [
      consent,
      setConsent,
      permission,
      contactsPermission,
      refreshPermission,
      requestCalendarPermissions,
      requestContactsPermissions,
      calendars,
    ],
  );

  return <CalendarSyncContext.Provider value={value}>{children}</CalendarSyncContext.Provider>;
}
