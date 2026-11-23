import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { useRouter } from 'expo-router';

import { parseDashboardPush } from '@/core/notifications/push-frame';
import type { SecureStorage } from '@/platform/secure-storage';
import { localNotifications, type NotificationPermissionState } from '@/platform/notifications';

import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useSessionSocket } from '@/features/session-socket-context';
import { countUnreadThreads } from '@/utils/count-unread';
import { replyPreview } from '@/utils/reply-preview';
import { useI18n } from '@/i18n/I18nProvider';
import { NotificationsContext, type NotificationsValue } from '@/features/notifications-context';

/** Persisted master switch (secure storage, ThemeProvider pattern). */
const ENABLED_KEY = 'notifications.enabled';
/** Server pushes may burst; the drawer tree refetch is throttled to this. */
const RELOAD_THROTTLE_MS = 8_000;

export function NotificationsProvider({
  storage,
  children,
}: {
  storage: SecureStorage;
  children: ReactNode;
}) {
  const router = useRouter();
  const { t: strings } = useI18n();
  const { user, ready, dropSession } = useAuth();
  const { reload, getActiveChat, drawerGroups } = useAppShell();

  const [enabled, setEnabledState] = useState(true);
  const [permission, setPermission] = useState<NotificationPermissionState>('undetermined');
  const [liveUnread, setLiveUnread] = useState(false);
  const lastReloadAtRef = useRef(0);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askedOnceRef = useRef(false);
  // The cold-start tap is consumed exactly once, and only once a navigator
  // can actually route (see the tap effect below).
  const initialTapHandledRef = useRef(false);
  // Latest push handler; the socket subscription reads it through the ref so
  // a re-render never tears the subscription down.
  const handlePushRef = useRef<
    (agentId: string, threadId: string | null, text: string, agentName: string | null) => void
  >(() => undefined);

  // Hydrate the persisted switch once per mount. Storage failure keeps the
  // default (enabled) — the OS permission still gates presentation.
  useEffect(() => {
    let cancelled = false;
    void storage
      .get(ENABLED_KEY)
      .then(value => {
        if (!cancelled && value === 'false') {
          setEnabledState(false);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
      if (!next) {
        // The socket that feeds this signal is torn down — drop the stale dot.
        setLiveUnread(false);
      }
      void storage.set(ENABLED_KEY, String(next)).catch(() => undefined);
    },
    [storage],
  );

  const refreshPermission = useCallback(
    () => localNotifications.getPermissionStatus().then(setPermission),
    [],
  );

  const requestPermission = useCallback(() => {
    return localNotifications.requestPermission().then(state => {
      setPermission(state);
      return state;
    });
  }, []);

  // Contextual ask, not a launch prompt — and only while the app is
  // foregrounded: an Alert fired in the background is invisible yet would
  // burn the one-shot ask.
  const askPermissionInContext = useCallback(() => {
    void (async () => {
      const status = await localNotifications.getPermissionStatus();
      setPermission(status);
      if (status !== 'undetermined') {
        return;
      }
      if (askedOnceRef.current || AppState.currentState !== 'active') {
        return;
      }
      askedOnceRef.current = true;
      Alert.alert(strings.notifications.askTitle, strings.notifications.askBody, [
        { text: strings.notifications.notNow, style: 'cancel' },
        {
          text: strings.notifications.enable,
          onPress: () => {
            // A hard denial leaves recovery to the Settings row that opens
            // system settings; surprising the user with a settings jump here
            // would read as punishment for answering.
            void requestPermission();
          },
        },
      ]);
    })();
  }, [requestPermission, strings.notifications]);

  const clearLiveUnread = useCallback(() => {
    setLiveUnread(false);
  }, []);

  // Sign-out must not leak the dot/badge or the ask flag into the next
  // account's session. Refs reset synchronously; state flips in a microtask
  // (set-state-in-effect).
  useEffect(() => {
    if (!user) {
      askedOnceRef.current = false;
      let cancelled = false;
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setLiveUnread(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [user]);

  const openFromTap = useCallback(
    (data: Record<string, unknown>) => {
      // No navigator exists before the auth gate renders the Stack — a tap
      // on a stale notification while logged out cannot route.
      if (!ready || !user) {
        return;
      }
      const agentId = typeof data.agentId === 'string' ? data.agentId : null;
      const threadId = typeof data.threadId === 'string' ? data.threadId : null;
      if (!agentId || !threadId) {
        return;
      }
      const title = typeof data.title === 'string' ? data.title : '';
      router.push({
        pathname: '/chat/[threadId]',
        params: { threadId: 'open', agent: agentId, thread: threadId, ...(title ? { title } : {}) },
      });
    },
    [ready, user, router],
  );

  // Configure once; register warm taps for the provider lifetime.
  useEffect(() => {
    localNotifications.configure();
    const unsubscribe = localNotifications.onTap(tap => openFromTap(tap.data));
    return unsubscribe;
  }, [openFromTap]);

  // Cold start: a tap may have launched the app. Routed only once the auth
  // gate has mounted a navigator — earlier pushes cannot be delivered by
  // the router and are consumed without replay (one-shot).
  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    if (initialTapHandledRef.current) {
      return;
    }
    initialTapHandledRef.current = true;
    void localNotifications.getInitialTap().then(tap => {
      void localNotifications.clearInitialTap();
      if (tap) {
        openFromTap(tap.data);
      }
    });
  }, [ready, user, openFromTap]);

  const handlePush = useCallback(
    (agentId: string, threadId: string | null, text: string, agentName: string | null) => {
      const active = getActiveChat();
      // The user is watching this exact conversation — the frames land in
      // the thread itself; a notification would only duplicate them.
      if (threadId && active?.agentId === agentId && active?.threadId === threadId) {
        return;
      }
      setLiveUnread(true);
      // Leading-edge throttled reload with a trailing catch-up: a push
      // inside the window must not lose its drawer refresh forever.
      const now = Date.now();
      const since = now - lastReloadAtRef.current;
      if (since > RELOAD_THROTTLE_MS) {
        lastReloadAtRef.current = now;
        reload();
      } else if (reloadTimerRef.current === null) {
        reloadTimerRef.current = setTimeout(() => {
          reloadTimerRef.current = null;
          lastReloadAtRef.current = Date.now();
          reload();
        }, RELOAD_THROTTLE_MS - since);
      }
      void (async () => {
        const status = await localNotifications.getPermissionStatus();
        setPermission(status);
        if (status === 'denied') {
          return;
        }
        if (status === 'undetermined') {
          askPermissionInContext();
          return;
        }
        // A push without a thread has nothing to deep-link to — the drawer
        // signal + badge above already cover it; a dead-end tap serves nobody.
        if (threadId === null) {
          return;
        }
        await localNotifications.presentLocal({
          title: agentName ?? strings.notifications.defaultTitle,
          body: text,
          data: { agentId, threadId, title: agentName ?? '' },
        });
      })();
    },
    [getActiveChat, reload, askPermissionInContext, strings.notifications],
  );

  // A reply this device streamed itself finished while the app was in the
  // background (the server does not push in that case — the socket is the
  // subscriber). Never prompts: a permission dialog cannot be answered
  // from the background, so an ungranted permission simply stays silent.
  const notifyReply = useCallback(
    (agentId: string, threadId: string, markdown: string, title?: string | null) => {
      if (!enabled) {
        return;
      }
      void (async () => {
        const status = await localNotifications.getPermissionStatus();
        setPermission(status);
        if (status !== 'granted') {
          return;
        }
        await localNotifications.presentLocal({
          title: title?.trim() || strings.notifications.defaultTitle,
          body: replyPreview(markdown),
          data: { agentId, threadId, title: title ?? '' },
        });
      })();
    },
    [enabled, strings.notifications],
  );

  // Latest handler into the ref after commit — never during render.
  useEffect(() => {
    handlePushRef.current = handlePush;
  }, [handlePush]);

  // Pushes arrive on the shared session socket; the master switch gates
  // presentation only — the socket stays up for device presence either way.
  const { status: sessionStatus, subscribe, resume } = useSessionSocket();

  useEffect(
    () =>
      subscribe(frame => {
        const push = parseDashboardPush(frame);
        if (push && enabled) {
          handlePushRef.current(push.agent_id, push.thread_id, push.text, push.agent_name);
        }
      }),
    // handlePush is read through its ref; `enabled` re-registers the filter.
    [subscribe, enabled],
  );

  useEffect(() => {
    if (sessionStatus === 'unauthorized') {
      dropSession();
    }
  }, [sessionStatus, dropSession]);

  // Foreground resume: the OS permission may have changed in system
  // settings (re-read it); the socket itself is probed by its own provider.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refreshPermission();
        resume();
      }
    });
    return () => subscription.remove();
  }, [refreshPermission, resume]);

  // App-icon badge = conversations with server-reported unread; the live
  // signal only adds one when nothing in the drawer reports unread yet.
  const unreadTotal = countUnreadThreads(drawerGroups);
  useEffect(() => {
    const total = unreadTotal + (liveUnread && unreadTotal === 0 ? 1 : 0);
    void localNotifications.setBadgeCount(total);
  }, [unreadTotal, liveUnread]);

  const value = useMemo<NotificationsValue>(
    () => ({
      enabled,
      setEnabled,
      permission,
      refreshPermission,
      requestPermission,
      liveUnread,
      clearLiveUnread,
      notifyReply,
      askPermissionInContext,
    }),
    [
      enabled,
      setEnabled,
      permission,
      refreshPermission,
      requestPermission,
      liveUnread,
      clearLiveUnread,
      notifyReply,
      askPermissionInContext,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
