import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import type { DrawerRoute, DrawerTaskGroup, DrawerThread } from '@/components/AppDrawer';
import type { ThreadSummary } from '@/core/api/types';
import { OctopApiError } from '@/core/api/errors';
import { ThreadsApi } from '@/core/api/threads';
import { fetchAgents, useAuth } from '@/features/auth';
import {
  AppShellContext,
  type ActiveChat,
  type AppShellValue,
  useAppShell,
} from '@/features/app-shell-context';
import { useI18n } from '@/i18n/I18nProvider';

export type { DrawerRoute };
export { useAppShell };

function mapThread(
  t: Pick<ThreadSummary, 'thread_id' | 'title' | 'pinned' | 'unread_count'>,
): DrawerThread {
  return {
    threadId: t.thread_id,
    title: t.title?.trim() ?? '',
    pinned: t.pinned,
    unreadCount: t.unread_count ?? 0,
  };
}

function sortThreads(items: DrawerThread[]): DrawerThread[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return 0;
  });
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, ready, httpClient } = useAuth();
  const { t: strings } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPresented, setDrawerPresented] = useState(false);
  const [groups, setGroups] = useState<DrawerTaskGroup[]>([]);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const openChatRef = useRef<{ agentId: string; threadId: string } | null>(null);
  // Mirror of `groups` for callbacks that must know whether an agent already
  // has a row without reading stale state.
  const groupsRef = useRef<DrawerTaskGroup[]>([]);

  useEffect(() => {
    activeUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  // Live agent tree for the drawer: experts with at least one thread,
  // fetched in parallel — experts without conversations stay out of the
  // task tree entirely (design shows only populated groups).
  const reload = useCallback(() => {
    if (!ready || !user) {
      return;
    }
    const forUserId = user.id;
    void (async () => {
      try {
        const agents = await fetchAgents(httpClient);
        const threadsApi = new ThreadsApi(httpClient);
        const populated = await Promise.all(
          agents.map(async a => ({
            agent: a,
            threads: await threadsApi.list(a.agent_id).catch(() => []),
          })),
        );
        setGroups(prev => {
          // Ignore results that finished after logout / account switch.
          if (activeUserIdRef.current !== forUserId) {
            return prev;
          }
          return populated
            .filter(({ threads }) => threads.length > 0)
            .map(({ agent, threads }) => {
              const existing = prev.find(g => g.agentId === agent.agent_id);
              return {
                name: agent.name,
                agentId: agent.agent_id,
                items: sortThreads(threads.map(mapThread)),
                // Groups start open: the drawer is a task switcher, and a
                // collapsed row only hides the conversation being looked for.
                expanded: existing?.expanded ?? true,
                threadsLoaded: true,
                iconName: agent.icon_name,
                iconUrl: agent.icon_url,
                color: agent.color,
              };
            });
        });
      } catch {
        // Drawer keeps the previous tree on refresh failures.
      }
    })();
  }, [ready, user, httpClient]);

  useEffect(() => {
    if (user) {
      reload();
      return;
    }
    // Clear account-scoped drawer state after logout without sync setState
    // in the effect body (react-hooks/set-state-in-effect).
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) {
        return;
      }
      setGroups([]);
      setDrawerOpen(false);
      setDrawerPresented(false);
      openChatRef.current = null;
    })();
    return () => {
      cancelled = true;
    };
  }, [user, reload]);

  /**
   * Refresh one agent's thread list. Called when a conversation is created or
   * opened and when the drawer is opened, so a thread started a second ago is
   * in the list without waiting for an app restart.
   */
  const refreshAgentThreads = useCallback(
    (agentId: string) => {
      if (!ready || !user) {
        return;
      }
      const forUserId = user.id;
      void (async () => {
        try {
          const threads = await new ThreadsApi(httpClient).list(agentId).catch(() => null);
          if (!threads || activeUserIdRef.current !== forUserId) {
            return;
          }
          const known = groupsRef.current.some(g => g.agentId === agentId);
          let meta: {
            name: string;
            iconName?: string | null;
            iconUrl?: string | null;
            color?: string | null;
          } | null = null;
          if (!known) {
            const agents = await fetchAgents(httpClient).catch(() => []);
            const agent = agents.find(a => a.agent_id === agentId);
            if (!agent) {
              return;
            }
            meta = {
              name: agent.name,
              iconName: agent.icon_name,
              iconUrl: agent.icon_url,
              color: agent.color,
            };
          }
          setGroups(prev => {
            if (activeUserIdRef.current !== forUserId) {
              return prev;
            }
            const existing = prev.find(g => g.agentId === agentId);
            if (existing) {
              return prev.map(g =>
                g.agentId === agentId
                  ? { ...g, threadsLoaded: true, items: sortThreads(threads.map(mapThread)) }
                  : g,
              );
            }
            if (!meta || threads.length === 0) {
              return prev;
            }
            return [
              ...prev,
              {
                name: meta.name,
                agentId,
                items: sortThreads(threads.map(mapThread)),
                expanded: true,
                threadsLoaded: true,
                iconName: meta.iconName,
                iconUrl: meta.iconUrl,
                color: meta.color,
              },
            ];
          });
        } catch {
          // A failed refresh leaves the current tree alone.
        }
      })();
    },
    [ready, user, httpClient],
  );

  const loadGroupThreads = useCallback(
    (group: DrawerTaskGroup) => {
      if (group.threadsLoaded) {
        return;
      }
      // Threads normally arrive pre-loaded with the tree; this is the
      // fallback refresh path for a group that missed the batch.
      void new ThreadsApi(httpClient)
        .list(group.agentId)
        .then(threads => {
          setGroups(prev =>
            prev.map(g =>
              g.agentId === group.agentId
                ? {
                    ...g,
                    threadsLoaded: true,
                    items: sortThreads(threads.map(mapThread)),
                  }
                : g,
            ),
          );
        })
        .catch(() => {
          // Leave unloaded; the next expand retries.
        });
    },
    [httpClient],
  );

  const openThread = useCallback(
    (group: DrawerTaskGroup, thread: { threadId: string; title: string }) => {
      setDrawerOpen(false);
      router.push({
        pathname: '/chat/[threadId]',
        params: {
          threadId: 'open',
          agent: group.agentId,
          thread: thread.threadId,
          title: thread.title,
        },
      });
    },
    [router],
  );

  const setActiveChat = useCallback(
    (chat: ActiveChat | null) => {
      const previous = openChatRef.current;
      openChatRef.current = chat;
      const changed =
        chat !== null &&
        (previous === null ||
          previous.agentId !== chat.agentId ||
          previous.threadId !== chat.threadId);
      if (changed) {
        // A new (or newly opened) conversation must show up in the drawer.
        refreshAgentThreads(chat.agentId);
      }
    },
    [refreshAgentThreads],
  );

  const getActiveChat = useCallback(() => openChatRef.current, []);

  const markThreadRead = useCallback((agentId: string, threadId: string) => {
    // Optimistic local clear after the server confirm arrives — the drawer
    // row badge, group capsule and tab dot drop without a full reload.
    setGroups(prev =>
      prev.map(g =>
        g.agentId !== agentId
          ? g
          : {
              ...g,
              items: g.items.map(item =>
                item.threadId === threadId ? { ...item, unreadCount: 0 } : item,
              ),
            },
      ),
    );
  }, []);

  const clearActiveChatIf = useCallback((chat: { agentId: string; threadId: string }) => {
    const open = openChatRef.current;
    if (open && open.agentId === chat.agentId && open.threadId === chat.threadId) {
      openChatRef.current = null;
    }
  }, []);

  const pinThread = useCallback(
    (group: DrawerTaskGroup, thread: DrawerThread) => {
      const previous = thread.pinned;
      const next = !previous;
      setGroups(prev =>
        prev.map(g =>
          g.agentId !== group.agentId
            ? g
            : {
                ...g,
                items: sortThreads(
                  g.items.map(item =>
                    item.threadId === thread.threadId ? { ...item, pinned: next } : item,
                  ),
                ),
              },
        ),
      );
      void new ThreadsApi(httpClient)
        .update(group.agentId, thread.threadId, { pinned: next })
        .catch(() => {
          setGroups(prev =>
            prev.map(g =>
              g.agentId !== group.agentId
                ? g
                : {
                    ...g,
                    items: sortThreads(
                      g.items.map(item =>
                        item.threadId === thread.threadId ? { ...item, pinned: previous } : item,
                      ),
                    ),
                  },
            ),
          );
          Alert.alert(strings.drawer.pin, strings.drawer.pinFailed);
        });
    },
    [httpClient, strings.drawer.pin, strings.drawer.pinFailed],
  );

  const deleteThread = useCallback(
    (group: DrawerTaskGroup, thread: DrawerThread) => {
      void (async () => {
        try {
          await new ThreadsApi(httpClient).remove(group.agentId, thread.threadId);
        } catch (error) {
          const active =
            error instanceof OctopApiError &&
            (error.code === 'THREAD_TURN_ACTIVE' || error.status === 409);
          Alert.alert(
            strings.drawer.deleteThreadTitle,
            active ? strings.drawer.deleteThreadActive : strings.drawer.deleteThreadFailed,
          );
          return;
        }

        setGroups(prev =>
          prev
            .map(g =>
              g.agentId !== group.agentId
                ? g
                : {
                    ...g,
                    items: g.items.filter(item => item.threadId !== thread.threadId),
                  },
            )
            .filter(g => g.items.length > 0),
        );

        const open = openChatRef.current;
        if (open?.agentId === group.agentId && open.threadId === thread.threadId) {
          openChatRef.current = null;
          router.replace('/chat');
        }
      })();
    },
    [
      httpClient,
      router,
      strings.drawer.deleteThreadActive,
      strings.drawer.deleteThreadFailed,
      strings.drawer.deleteThreadTitle,
    ],
  );

  const openDrawer = useCallback(() => {
    setDrawerPresented(true);
    setDrawerOpen(true);
    const active = openChatRef.current;
    if (active) {
      refreshAgentThreads(active.agentId);
    }
  }, [refreshAgentThreads]);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const finishDrawerClose = useCallback(() => setDrawerPresented(false), []);

  const value = useMemo<AppShellValue>(
    () => ({
      drawerOpen,
      drawerPresented,
      openDrawer,
      closeDrawer,
      finishDrawerClose,
      // Render-level gate keeps the tree empty when signed out.
      drawerGroups: user ? groups : [],
      reload,
      getActiveChat,
      markThreadRead,
      navigate: route => {
        setDrawerOpen(false);
        if (route === 'knowledge') {
          router.push('/knowledge');
          return;
        }
        if (route === 'usage') {
          router.push('/usage');
          return;
        }
        if (route === 'connect') {
          router.push('/connect');
          return;
        }
        router.push('/settings');
      },
      loadGroupThreads,
      openThread,
      setActiveChat,
      clearActiveChatIf,
      pinThread,
      deleteThread,
    }),
    [
      drawerOpen,
      drawerPresented,
      openDrawer,
      closeDrawer,
      finishDrawerClose,
      groups,
      user,
      router,
      reload,
      getActiveChat,
      markThreadRead,
      loadGroupThreads,
      openThread,
      setActiveChat,
      clearActiveChatIf,
      pinThread,
      deleteThread,
    ],
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}
