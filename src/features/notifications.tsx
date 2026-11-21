import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { useRouter } from 'expo-router';

import { parseDashboardPush } from '@/core/notifications/push-frame';
import { ChatSocket } from '@/core/chat/chat-socket';
import type { SecureStorage } from '@/platform/secure-storage';
import { localNotifications, type NotificationPermissionState } from '@/platform/notifications';

import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { countUnreadThreads } from '@/utils/count-unread';
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
  const { baseUrl, token, user, ready, sessionGeneration, dropSession } = useAuth();
  const { reload, getActiveChat, drawerGroups } = useAppShell();

  const [enabled, setEnabledState] = useState(true);
  const [permission, setPermission] = useState<NotificationPermissionState>('undetermined');
  const [liveUnread, setLiveUnread] = useState(false);
  const socketRef = useRef<ChatSocket | null>(null);
  // Mirrors the auth token so every (re)connect reads the latest value —
  // sliding renewal must not require a socket rebuild (auth.tsx pattern).
  const tokenRef = useRef<string | null>(token);
  const lastReloadAtRef = useRef(0);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askedOnceRef = useRef(false);
  // The cold-start tap is consumed exactly once, and only once a navigator
  // can actually route (see the tap effect below).
  const initialTapHandledRef = useRef(false);
  // Latest push handler; the socket effect reads it through the ref so a
  // re-render never tears the connection down.
  const handlePushRef = useRef<
    (agentId: string, threadId: string | null, text: string, agentName: string | null) => void
  >(() => undefined);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

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
          // Contextual ask, not a launch prompt — and only while the app is
          // foregrounded: an Alert fired in the background is invisible yet
          // would burn the one-shot ask.
          if (askedOnceRef.current || AppState.currentState !== 'active') {
            return;
          }
          askedOnceRef.current = true;
          Alert.alert(strings.notifications.askTitle, strings.notifications.askBody, [
            { text: strings.notifications.notNow, style: 'cancel' },
            {
              text: strings.notifications.enable,
              onPress: () => {
                void requestPermission().then(state => {
                  if (state === 'granted') {
                    void localNotifications.presentLocal({
                      title: agentName ?? strings.notifications.defaultTitle,
                      body: text,
                      data: { agentId, threadId, title: agentName ?? '' },
                    });
                  }
                });
              },
            },
          ]);
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
    [getActiveChat, reload, requestPermission, strings.notifications],
  );

  // Latest handler into the ref after commit — never during render.
  useEffect(() => {
    handlePushRef.current = handlePush;
  }, [handlePush]);

  // One notifications socket per signed-in session; rebuilt on account or
  // server changes, torn down on logout or when the user disables it.
  const sessionKey = `${user?.id ?? 'anon'}:${sessionGeneration}:${baseUrl ?? ''}:${enabled}`;
  useEffect(() => {
    if (!ready || !user || !baseUrl || !enabled) {
      return;
    }
    const socket = new ChatSocket({
      baseUrl,
      path: '/api/notifications/ws',
      tokenFactory: () => Promise.resolve(tokenRef.current),
      onFrame: frame => {
        const push = parseDashboardPush(frame);
        if (push) {
          handlePushRef.current(push.agent_id, push.thread_id, push.text, push.agent_name);
        }
      },
      onStatus: status => {
        if (status === 'unauthorized') {
          dropSession();
        }
      },
    });
    socketRef.current = socket;
    void socket.connect().catch(() => {
      // Reconnect backoff owns retrying; nothing to surface here.
    });
    return () => {
      socketRef.current = null;
      socket.close();
    };
    // sessionKey encodes user/generation/baseUrl/enabled — the deps the
    // socket identity depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, ready, dropSession]);

  // Foreground resume: a long background suspends the socket (nudge it) and
  // the OS permission may have changed in system settings (re-read it).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refreshPermission();
        const socket = socketRef.current;
        if (socket && (socket.status === 'closed' || socket.status === 'reconnecting')) {
          void socket.connect().catch(() => undefined);
        }
      }
    });
    return () => subscription.remove();
  }, [refreshPermission]);

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
    }),
    [
      enabled,
      setEnabled,
      permission,
      refreshPermission,
      requestPermission,
      liveUnread,
      clearLiveUnread,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
