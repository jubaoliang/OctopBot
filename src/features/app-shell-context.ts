import { createContext, useContext } from 'react';

import type { DrawerRoute, DrawerTaskGroup, DrawerThread } from '@/components/AppDrawer';

/**
 * Isolated from `app-shell.tsx` so Fast Refresh of provider logic does not
 * recreate the context object (which would make consumers see `null`).
 */

/** The conversation currently on screen (non-reactive ref reads). */
export type ActiveChat = { agentId: string; threadId: string };

export interface AppShellValue {
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
  /** Refetches the drawer tree (agents + threads) from the server. */
  reload: () => void;
  /** The conversation currently on screen, if any. */
  getActiveChat: () => ActiveChat | null;
  navigate: (route: DrawerRoute) => void;
  /** Loads an expert's threads into the drawer tree (first expand). */
  loadGroupThreads: (group: DrawerTaskGroup) => void;
  /** Opens an existing conversation thread. */
  openThread: (group: DrawerTaskGroup, thread: { threadId: string; title: string }) => void;
  /** Chat screens register the conversation currently on screen. */
  setActiveChat: (chat: ActiveChat | null) => void;
  /** Clear only if `chat` is still the registered active conversation. */
  clearActiveChatIf: (chat: ActiveChat) => void;
  /** Zeroes a thread's local unread badge after the server confirm arrives. */
  markThreadRead: (agentId: string, threadId: string) => void;
  pinThread: (group: DrawerTaskGroup, thread: DrawerThread) => void;
  deleteThread: (group: DrawerTaskGroup, thread: DrawerThread) => void;
}

export const AppShellContext = createContext<AppShellValue | null>(null);

export function useAppShell(): AppShellValue {
  const value = useContext(AppShellContext);
  if (!value) {
    throw new Error('useAppShell must be used inside AppShellProvider');
  }
  return value;
}
