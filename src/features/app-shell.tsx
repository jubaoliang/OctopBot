import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'expo-router';

import type { DrawerRoute, DrawerTaskGroup } from '@/components/AppDrawer';
import { ThreadsApi } from '@/core/api/threads';
import { fetchAgents, useAuth } from '@/features/auth';

export type { DrawerRoute };

interface AppShellValue {
  /** Requested drawer state — the drawer animates toward it. */
  drawerOpen: boolean;
  /**
   * True from the moment the drawer opens until its close animation has
   * finished. Chrome that must not overlap the drawer keys on this.
   */
  drawerPresented: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Called by the drawer once its close animation completes. */
  finishDrawerClose: () => void;
  drawerGroups: DrawerTaskGroup[];
  navigate: (route: DrawerRoute) => void;
  /** Loads an expert's threads into the drawer tree (first expand). */
  loadGroupThreads: (group: DrawerTaskGroup) => void;
  /** Opens an existing conversation thread. */
  openThread: (group: DrawerTaskGroup, thread: { threadId: string; title: string }) => void;
}

const AppShellContext = createContext<AppShellValue | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, ready, httpClient } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPresented, setDrawerPresented] = useState(false);
  const [groups, setGroups] = useState<DrawerTaskGroup[]>([]);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  useEffect(() => {
    activeUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

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
                items: threads.map(t => ({
                  threadId: t.thread_id,
                  title: t.title?.trim() ?? '',
                })),
                expanded: existing?.expanded ?? false,
                threadsLoaded: true,
                iconName: agent.icon_name,
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
    })();
    return () => {
      cancelled = true;
    };
  }, [user, reload]);

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
                    items: threads.map(t => ({
                      threadId: t.thread_id,
                      title: t.title?.trim() ?? '',
                    })),
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

  const openDrawer = useCallback(() => {
    setDrawerPresented(true);
    setDrawerOpen(true);
  }, []);
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
      navigate: route => {
        setDrawerOpen(false);
        if (route === 'usage') {
          // A detail screen pushed above the tabs; it has its own back button.
          router.push('/usage');
          return;
        }
        router.push({
          pathname: route === 'chat' ? '/chat' : `/(tabs)/${route}`,
        });
      },
      loadGroupThreads,
      openThread,
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
      loadGroupThreads,
      openThread,
    ],
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell(): AppShellValue {
  const value = useContext(AppShellContext);
  if (!value) {
    throw new Error('useAppShell must be used inside AppShellProvider');
  }
  return value;
}
