import { createContext, useContext } from 'react';

import type { NotificationPermissionState } from '@/platform/notifications';

/**
 * Isolated from `notifications.tsx` so Fast Refresh of provider logic does
 * not recreate the context object (which would make consumers see `null`).
 */

export interface NotificationsValue {
  /**
   * Master switch (persisted). When false: no socket, no in-app signals,
   * no local notifications — the OS permission still gates presentation
   * independently.
   */
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  /** OS notification permission, refreshed after asks and app resumes. */
  permission: NotificationPermissionState;
  /** Re-reads the OS permission state (settings return, screen focus). */
  refreshPermission: () => Promise<void>;
  /** Requests the OS permission; resolves with the resulting state. */
  requestPermission: () => Promise<NotificationPermissionState>;
  /** True while an unconsumed push has arrived (drives the tab dot). */
  liveUnread: boolean;
  /** Consumes the live-unread signal (called when a thread is opened). */
  clearLiveUnread: () => void;
  /**
   * Posts a system notification for a reply the device streamed itself
   * (socket alive, app in the background). Never prompts: a permission
   * dialog cannot be answered from the background.
   */
  notifyReply: (agentId: string, threadId: string, markdown: string, title?: string | null) => void;
  /**
   * Contextual one-shot permission ask while the app is foregrounded —
   * called when the user has a reason to want notifications (just sent a
   * message, a push arrived).
   */
  askPermissionInContext: () => void;
}

export const NotificationsContext = createContext<NotificationsValue | null>(null);

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error('useNotifications must be used inside NotificationsProvider');
  }
  return value;
}
