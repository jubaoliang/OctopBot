import * as ExpoNotifications from 'expo-notifications';
// The eslint import resolver cannot follow the package's star-export chain
// to this enum — import it from its defining module (stable in the SDK).
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { Platform } from 'react-native';

/**
 * Platform local notifications — the ONLY place expo-notifications is
 * imported (AGENTS.md wrapper hygiene; a HarmonyOS shim swaps this module).
 *
 * v1 scope: local notifications presented from the app's own live socket.
 * Remote push (server relay → APNs/FCM) plugs in here later behind the
 * same interface — registration/token plumbing is deliberately absent.
 *
 * Best-effort everywhere: a device without notification support, or a
 * denied permission, degrades to in-app badges — nothing here may throw
 * into the UI (haptics.ts run() pattern).
 */

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

export interface LocalNotificationPayload {
  title: string;
  body?: string;
  /** Tap-handling payload; flat string/null values only. */
  data?: Record<string, string | null>;
}

export interface NotificationTap {
  data: Record<string, unknown>;
}

export interface LocalNotifications {
  /** iOS foreground presentation + the Android channel. Call once at mount. */
  configure: () => void;
  requestPermission: () => Promise<NotificationPermissionState>;
  getPermissionStatus: () => Promise<NotificationPermissionState>;
  presentLocal: (payload: LocalNotificationPayload) => Promise<void>;
  setBadgeCount: (count: number) => Promise<void>;
  /** Fires when the user taps a notification (warm or cold start). */
  onTap: (callback: (tap: NotificationTap) => void) => () => void;
  /** The tap that launched the app, if any (cold start only). */
  getInitialTap: () => Promise<NotificationTap | null>;
  /**
   * Consumes the cold-start tap so it cannot replay on a later launch —
   * the response persists in the SDK until explicitly cleared.
   */
  clearInitialTap: () => Promise<void>;
}

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function toState(status: string): NotificationPermissionState {
  if (status === 'granted') {
    return 'granted';
  }
  if (status === 'denied') {
    return 'denied';
  }
  return 'undetermined';
}

function tapDataOf(data: unknown): Record<string, unknown> {
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
}

const noopNotifications: LocalNotifications = {
  configure: () => undefined,
  requestPermission: async () => 'denied',
  getPermissionStatus: async () => 'denied',
  presentLocal: async () => undefined,
  setBadgeCount: async () => undefined,
  onTap: () => () => undefined,
  getInitialTap: async () => null,
  clearInitialTap: async () => undefined,
};

const expoNotifications: LocalNotifications = {
  configure: () => {
    if (!supported) {
      return;
    }
    // iOS: present while the app is foregrounded — a proactive nudge that
    // arrives mid-session must still be visible (it is suppressed for the
    // on-screen thread before this is ever called).
    ExpoNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      // HIGH importance so a proactive nudge heads-up banners even while
      // the app is foregrounded — a silent shade-only post is invisible to
      // a user looking at the screen. A fresh channel id ('alerts') is used
      // because Android locks a channel's importance after first creation;
      // the legacy 'default' channel (DEFAULT importance) stays orphaned.
      void ExpoNotifications.setNotificationChannelAsync('alerts', {
        name: 'Assistant',
        importance: AndroidImportance.HIGH,
      }).catch(() => undefined);
    }
  },
  requestPermission: async () => {
    if (!supported) {
      return 'denied';
    }
    try {
      return toState((await ExpoNotifications.requestPermissionsAsync()).status);
    } catch {
      return 'denied';
    }
  },
  getPermissionStatus: async () => {
    if (!supported) {
      return 'denied';
    }
    try {
      return toState((await ExpoNotifications.getPermissionsAsync()).status);
    } catch {
      return 'denied';
    }
  },
  presentLocal: async payload => {
    if (!supported) {
      return;
    }
    try {
      await ExpoNotifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
        },
        // Android: the channel only travels on the trigger — `{ channelId }`
        // is the SDK's immediate-delivery trigger; `null` would drop the
        // notification into the SDK's fallback channel. iOS: null = now.
        trigger: Platform.OS === 'android' ? { channelId: 'alerts' } : null,
      });
    } catch {
      // Presentation is best-effort; the in-app signal already fired.
    }
  },
  setBadgeCount: async count => {
    if (!supported) {
      return;
    }
    try {
      await ExpoNotifications.setBadgeCountAsync(count);
    } catch {
      // Best-effort; Android launchers without badge support reject.
    }
  },
  onTap: callback => {
    if (!supported) {
      return () => undefined;
    }
    const subscription = ExpoNotifications.addNotificationResponseReceivedListener(response => {
      callback({ data: tapDataOf(response.notification.request.content.data) });
    });
    return () => subscription.remove();
  },
  getInitialTap: async () => {
    if (!supported) {
      return null;
    }
    try {
      const response = await ExpoNotifications.getLastNotificationResponseAsync();
      if (!response) {
        return null;
      }
      return { data: tapDataOf(response.notification.request.content.data) };
    } catch {
      return null;
    }
  },
  clearInitialTap: async () => {
    if (!supported) {
      return;
    }
    try {
      await ExpoNotifications.clearLastNotificationResponseAsync();
    } catch {
      // Best-effort; a stale response at worst replays one navigation.
    }
  },
};

export const localNotifications: LocalNotifications = supported
  ? expoNotifications
  : noopNotifications;
