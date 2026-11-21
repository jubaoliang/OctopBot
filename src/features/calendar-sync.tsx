import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { KnowledgeApi } from '@/core/api/knowledge';
import { buildScheduleDigest, DIGEST_DAYS } from '@/core/schedule/digest';
import { buildContactsDigest } from '@/core/contacts/digest';
import { knowledgeDocumentId } from '@/utils/knowledge-tree';
import { calendarReader, type DeviceCalendar } from '@/platform/calendar';
import { contactsReader, type ContactsPermissionState } from '@/platform/contacts';
import type { SecureStorage } from '@/platform/secure-storage';

import { useAuth } from '@/features/auth';
import { CalendarSyncContext, type CalendarSyncValue } from '@/features/calendar-sync-context';

const ENABLED_KEY = 'calendar.enabled';
const KB_ID_KEY = 'calendar.kbId';
const LAST_SYNC_KEY = 'calendar.lastSync';
const CONTACTS_ENABLED_KEY = 'contacts.enabled';
const CONTACTS_KB_ID_KEY = 'contacts.kbId';

/** Names of the auto-created knowledge bases (visible in the web console). */
const SCHEDULE_KB_NAME = 'My Schedule';
const SCHEDULE_DOC_NAME = 'schedule.md';
const CONTACTS_KB_NAME = 'My Contacts';
const CONTACTS_DOC_NAME = 'contacts.md';
const SCHEDULE_KB_DESCRIPTION = 'Rolling schedule digest from the Octop mobile device.';
const CONTACTS_KB_DESCRIPTION = 'Address-book digest from the Octop mobile device.';
/** Minimum gap between automatic syncs; manual "Sync now" bypasses it. */
const AUTO_SYNC_MIN_INTERVAL_MS = 15 * 60_000;

export function CalendarSyncProvider({
  storage,
  children,
}: {
  storage: SecureStorage;
  children: ReactNode;
}) {
  const { httpClient, user, ready } = useAuth();
  const [enabled, setEnabledState] = useState(false);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [kbId, setKbId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [contactsEnabled, setContactsEnabledState] = useState(false);
  const [contactsPermission, setContactsPermission] =
    useState<ContactsPermissionState>('undetermined');
  const [contactsKbId, setContactsKbId] = useState<string | null>(null);
  // Identity-stable mirrors for callbacks that must not change identity —
  // syncNow in particular stays reference-stable so the enable/resume
  // effects that call it cannot loop on its identity changes.
  const httpClientRef = useRef(httpClient);
  const enabledRef = useRef(enabled);
  const contactsEnabledRef = useRef(contactsEnabled);
  const contactsKbIdRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const kbIdRef = useRef<string | null>(null);
  const lastAutoSyncRef = useRef(0);
  /**
   * Consent generation: bumped whenever a capability is disabled or its
   * selection is emptied. In-flight syncs capture the generation at start
   * and abort their writes when it moved — the user's opt-out always wins
   * over a digest that was already being computed.
   */
  const consentGenRef = useRef(0);

  useEffect(() => {
    httpClientRef.current = httpClient;
  }, [httpClient]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    contactsEnabledRef.current = contactsEnabled;
  }, [contactsEnabled]);
  useEffect(() => {
    contactsKbIdRef.current = contactsKbId;
  }, [contactsKbId]);

  // Hydrate persisted state once per mount.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      storage.get(ENABLED_KEY),
      storage.get(KB_ID_KEY),
      storage.get(LAST_SYNC_KEY),
      storage.get(CONTACTS_ENABLED_KEY),
      storage.get(CONTACTS_KB_ID_KEY),
    ])
      .then(([enabledValue, kbValue, lastValue, contactsValue, contactsKbValue]) => {
        if (cancelled) {
          return;
        }
        if (enabledValue === 'true') {
          setEnabledState(true);
        }
        if (kbValue) {
          kbIdRef.current = kbValue;
          setKbId(kbValue);
        }
        const last = lastValue ? Number(lastValue) : Number.NaN;
        if (!Number.isNaN(last) && last > 0) {
          setLastSyncAt(last);
          lastAutoSyncRef.current = last;
        }
        if (contactsValue === 'true') {
          setContactsEnabledState(true);
        }
        if (contactsKbValue) {
          contactsKbIdRef.current = contactsKbValue;
          setContactsKbId(contactsKbValue);
        }
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

  /**
   * Find-or-create the digest KB and replace its document. Shared by both
   * capabilities; the stored base may have been deleted server-side, which
   * is checked cheaply before the write. When the doc listing of a verified
   * existing base fails (transient), the write is skipped rather than
   * creating a duplicate document. `isStale` is consulted before every
   * server call so a consent change that lands mid-write aborts it.
   */
  const writeDigest = useCallback(
    async (
      kbName: string,
      kbDescription: string,
      docName: string,
      digest: string,
      storedKbId: string | null,
      onBaseId: (id: string) => void,
      isStale: () => boolean = () => false,
    ): Promise<string | null> => {
      const api = new KnowledgeApi(httpClientRef.current);
      let baseId = storedKbId;
      let verifiedExisting = false;
      if (!isStale() && baseId) {
        try {
          const bases = await api.bases();
          if (!bases.some(base => base.knowledge_base_id === baseId)) {
            baseId = null;
          } else {
            verifiedExisting = true;
          }
        } catch {
          // Network hiccup — keep the stored id and let the write surface it.
        }
      }
      if (!isStale() && !baseId) {
        const created = await api.createBase(kbName, kbDescription);
        baseId = created.knowledge_base_id;
        onBaseId(baseId);
      }
      if (isStale() || baseId === null) {
        return baseId;
      }
      let docId: string | null = null;
      try {
        const docs = await api.documents(baseId);
        // Some payloads only carry document_id — normalize via the helper.
        const existing = docs.find(doc => doc.filename === docName);
        docId = existing ? knowledgeDocumentId(existing) || null : null;
      } catch {
        if (verifiedExisting) {
          // Transient listing failure on an existing base — skip this run
          // instead of creating a second copy of the document.
          return baseId;
        }
        // A fresh base legitimately has no docs yet; create below.
      }
      if (isStale()) {
        return baseId;
      }
      if (docId === null) {
        await api.createTextDocument(baseId, {
          name: docName,
          content: digest,
        });
      } else {
        await api.updateTextContent(baseId, docId, digest);
      }
      return baseId;
    },
    [],
  );

  /** Consent gate for the schedule capability: stop syncs, blank the KB doc. */
  const disconnectSchedule = useCallback(() => {
    consentGenRef.current += 1;
    if (kbIdRef.current === null) {
      return;
    }
    void writeDigest(
      SCHEDULE_KB_NAME,
      SCHEDULE_KB_DESCRIPTION,
      SCHEDULE_DOC_NAME,
      '_Schedule sync is disabled on the device._',
      kbIdRef.current,
      id => {
        kbIdRef.current = id;
        setKbId(id);
        void storage.set(KB_ID_KEY, id).catch(() => undefined);
      },
    ).catch(() => undefined);
  }, [writeDigest, storage]);

  /** Consent gate for the contacts capability: stop syncs, blank the KB doc. */
  const disconnectContacts = useCallback(() => {
    consentGenRef.current += 1;
    if (contactsKbIdRef.current === null) {
      return;
    }
    void writeDigest(
      CONTACTS_KB_NAME,
      CONTACTS_KB_DESCRIPTION,
      CONTACTS_DOC_NAME,
      '_Contacts sync is disabled on the device._',
      contactsKbIdRef.current,
      id => {
        contactsKbIdRef.current = id;
        setContactsKbId(id);
        void storage.set(CONTACTS_KB_ID_KEY, id).catch(() => undefined);
      },
    ).catch(() => undefined);
  }, [writeDigest, storage]);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) {
      return;
    }
    const scheduleOn = enabledRef.current;
    const contactsOn = contactsEnabledRef.current;
    if (!scheduleOn && !contactsOn) {
      return;
    }
    syncingRef.current = true;
    // Deferred off the effect body (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => setSyncing(true));
    const now = new Date();
    const gen = consentGenRef.current;
    let anySuccess = false;
    if (scheduleOn) {
      try {
        const status = await calendarReader.getPermissionStatus();
        setPermission(status);
        // Re-check the switch AND the consent generation after the awaits:
        // a disable that landed mid-sync must win over this run's writes.
        if (status === 'granted' && enabledRef.current && consentGenRef.current === gen) {
          // Every readable calendar feeds the digest — the connect switch
          // is the consent gate, not per-calendar selection.
          const allCalendars = await calendarReader.getReadableCalendars();
          const events = await calendarReader.listEvents(
            allCalendars.map(calendar => calendar.id),
            now,
            new Date(now.getTime() + DIGEST_DAYS * 86_400_000),
          );
          const digest = buildScheduleDigest(events, now);
          if (digest !== null && consentGenRef.current === gen) {
            // digest === null keeps the previous schedule digest on purpose.
            await writeDigest(
              SCHEDULE_KB_NAME,
              SCHEDULE_KB_DESCRIPTION,
              SCHEDULE_DOC_NAME,
              digest,
              kbIdRef.current,
              id => {
                kbIdRef.current = id;
                setKbId(id);
                void storage.set(KB_ID_KEY, id).catch(() => undefined);
              },
              () => consentGenRef.current !== gen,
            );
            anySuccess = true;
          }
        }
      } catch {
        // Server refused (feature disabled, permissions, offline) — the
        // next trigger retries; nothing to surface from a background sync.
      }
    }
    if (contactsOn) {
      try {
        const status = await contactsReader.getPermissionStatus();
        setContactsPermission(status);
        if (status === 'granted' && contactsEnabledRef.current && consentGenRef.current === gen) {
          const cards = await contactsReader.listContacts();
          // An empty read (transient failure or genuinely empty book) must
          // not wipe the previously synced digest.
          if (cards.length > 0 && consentGenRef.current === gen) {
            await writeDigest(
              CONTACTS_KB_NAME,
              CONTACTS_KB_DESCRIPTION,
              CONTACTS_DOC_NAME,
              buildContactsDigest(cards),
              contactsKbIdRef.current,
              id => {
                contactsKbIdRef.current = id;
                setContactsKbId(id);
                void storage.set(CONTACTS_KB_ID_KEY, id).catch(() => undefined);
              },
              () => consentGenRef.current !== gen,
            );
            anySuccess = true;
          }
        }
      } catch {
        // Same failure scope as the schedule branch.
      }
    }
    if (anySuccess) {
      const stamp = now.getTime();
      lastAutoSyncRef.current = stamp;
      setLastSyncAt(stamp);
      void storage.set(LAST_SYNC_KEY, String(stamp)).catch(() => undefined);
    }
    syncingRef.current = false;
    setSyncing(false);
  }, [storage, writeDigest]);

  const requestPermissions = useCallback(
    () =>
      calendarReader.requestPermissions().then(state => {
        setPermission(state);
        // A grant after enable is what makes the first schedule sync possible.
        if (state === 'granted') {
          void Promise.resolve().then(() => syncNow());
        }
        return state;
      }),
    // syncNow is reference-stable.
    [syncNow],
  );

  const requestContactsPermissions = useCallback(
    () =>
      contactsReader.requestPermissions().then(state => {
        setContactsPermission(state);
        if (state === 'granted') {
          void Promise.resolve().then(() => syncNow());
        }
        return state;
      }),
    [syncNow],
  );

  // Load the device calendar list whenever permission becomes granted.
  useEffect(() => {
    if (permission !== 'granted') {
      // Async microtask keeps the reset out of the effect body
      // (react-hooks/set-state-in-effect).
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
    void calendarReader.getReadableCalendars().then(list => {
      if (!cancelled) {
        setCalendars(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [permission]);

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
      void storage.set(ENABLED_KEY, String(next)).catch(() => undefined);
      if (next) {
        void requestPermissions().then(state => {
          if (state === 'granted') {
            void calendarReader.getReadableCalendars().then(setCalendars);
          }
        });
        return;
      }
      // Disconnect is a consent gate: stop syncs and blank the server-side
      // schedule digest so server-side turns stop seeing it.
      disconnectSchedule();
    },
    [storage, requestPermissions, disconnectSchedule],
  );

  const setContactsEnabled = useCallback(
    (next: boolean) => {
      setContactsEnabledState(next);
      void storage.set(CONTACTS_ENABLED_KEY, String(next)).catch(() => undefined);
      if (next) {
        void requestContactsPermissions();
        return;
      }
      // Disconnect is a consent gate: stop syncs and blank the server-side
      // digest so no server turn can keep reading the address book.
      disconnectContacts();
    },
    [storage, requestContactsPermissions, disconnectContacts],
  );

  // Enable / login: run the first sync (both capabilities read their own
  // permission inside syncNow; a permission grant triggers its own sync).
  // Deferred off the effect body so the sync's state updates never cascade
  // inside the effect itself.
  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    void Promise.resolve().then(() => {
      void refreshPermission();
      void syncNow();
    });
  }, [ready, user, enabled, contactsEnabled, refreshPermission, syncNow]);

  // App resume: re-read permissions and auto-sync if the window elapsed.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        return;
      }
      void refreshPermission();
      const since = Date.now() - lastAutoSyncRef.current;
      if ((enabledRef.current || contactsEnabledRef.current) && since > AUTO_SYNC_MIN_INTERVAL_MS) {
        void syncNow();
      }
    });
    return () => subscription.remove();
  }, [refreshPermission, syncNow]);

  const value = useMemo<CalendarSyncValue>(
    () => ({
      enabled,
      setEnabled,
      permission,
      refreshPermission,
      requestPermissions,
      calendars,
      kbId,
      lastSyncAt,
      syncing,
      syncNow,
      contactsEnabled,
      setContactsEnabled,
      contactsPermission,
      requestContactsPermissions,
      contactsKbId,
    }),
    [
      enabled,
      setEnabled,
      permission,
      refreshPermission,
      requestPermissions,
      calendars,
      kbId,
      lastSyncAt,
      syncing,
      syncNow,
      contactsEnabled,
      setContactsEnabled,
      contactsPermission,
      requestContactsPermissions,
      contactsKbId,
    ],
  );

  return <CalendarSyncContext.Provider value={value}>{children}</CalendarSyncContext.Provider>;
}
