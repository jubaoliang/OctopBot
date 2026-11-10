import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';

import type { DrawerTaskGroup } from '@/components/AppDrawer';

export type DrawerRoute = 'chat' | 'experts' | 'automation';

interface AppShellValue {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  drawerGroups: DrawerTaskGroup[];
  userName?: string;
  navigate: (route: DrawerRoute) => void;
}

const AppShellContext = createContext<AppShellValue | null>(null);

/**
 * Demo task tree mirroring the design frames — replaced by the real
 * agent/thread tree once the API layer is wired to the drawer.
 */
const demoGroups: DrawerTaskGroup[] = [
  { name: '通用技能', items: ['这里是文案这里是文案', '这里是文案这里是文案'], expanded: true },
  { name: '运维工程师 ops', items: ['这里是文案这里是文案'], expanded: true },
  { name: '热点记者', items: ['这里是文案这里是文案'], expanded: true },
  { name: '基层医生学习小助手', items: [], expanded: false },
  { name: '系统医生', items: [], expanded: false },
];

export function AppShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const value = useMemo<AppShellValue>(
    () => ({
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      drawerGroups: demoGroups,
      navigate: route => {
        setDrawerOpen(false);
        router.push({
          pathname: route === 'chat' ? '/chat' : `/(tabs)/${route}`,
        });
      },
    }),
    [drawerOpen, router],
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
