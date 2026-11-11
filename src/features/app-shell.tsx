import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'expo-router';

import type { DrawerTaskGroup } from '@/components/AppDrawer';
import { fetchAgents, useAuth } from '@/features/auth';

export type DrawerRoute = 'chat' | 'experts' | 'automation';

interface AppShellValue {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  drawerGroups: DrawerTaskGroup[];
  navigate: (route: DrawerRoute) => void;
}

const AppShellContext = createContext<AppShellValue | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, ready, httpClient } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [groups, setGroups] = useState<DrawerTaskGroup[]>([]);

  // Live agent tree for the drawer; threads land under each group later.
  const reload = useCallback(() => {
    if (!ready || !user) {
      return;
    }
    void fetchAgents(httpClient)
      .then(agents => {
        setGroups(agents.map(a => ({ name: a.name, items: [], expanded: false })));
      })
      .catch(() => {
        // Drawer keeps the previous tree on refresh failures.
      });
  }, [ready, user, httpClient]);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo<AppShellValue>(
    () => ({
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      // Render-level gate keeps the tree empty when signed out.
      drawerGroups: user ? groups : [],
      navigate: route => {
        setDrawerOpen(false);
        router.push({
          pathname: route === 'chat' ? '/chat' : `/(tabs)/${route}`,
        });
      },
    }),
    [drawerOpen, groups, user, router],
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
