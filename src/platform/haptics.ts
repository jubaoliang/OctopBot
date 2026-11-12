import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Platform haptics — the ONLY place expo-haptics is imported (AGENTS.md
 * wrapper hygiene; a HarmonyOS shim swaps this module).
 *
 * Usage rules (Apple HIG, "Playing haptics"): one haptic per user action,
 * fired at the causal moment, and never as the only feedback — haptics are
 * off for many users, so the visual change must stand on its own.
 */
export interface Haptics {
  /** A value ticked to a new step: tab change, segmented control, picker. */
  selection: () => void;
  /** Something committed or snapped home: message sent, drawer dismissed. */
  impact: (weight?: 'light' | 'medium') => void;
  /** An operation finished: success, warning (destructive prompt), error. */
  notify: (kind: 'success' | 'warning' | 'error') => void;
}

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function run(effect: () => Promise<void>): void {
  if (!supported) {
    return;
  }
  // Haptics are best-effort: a device without a Taptic Engine, or one with
  // system haptics disabled, rejects — that must never surface to the UI.
  effect().catch(() => undefined);
}

export const haptics: Haptics = {
  selection: () => {
    run(() => ExpoHaptics.selectionAsync());
  },
  impact: (weight = 'light') => {
    run(() =>
      ExpoHaptics.impactAsync(
        weight === 'medium'
          ? ExpoHaptics.ImpactFeedbackStyle.Medium
          : ExpoHaptics.ImpactFeedbackStyle.Light,
      ),
    );
  },
  notify: kind => {
    const type =
      kind === 'success'
        ? ExpoHaptics.NotificationFeedbackType.Success
        : kind === 'warning'
          ? ExpoHaptics.NotificationFeedbackType.Warning
          : ExpoHaptics.NotificationFeedbackType.Error;
    run(() => ExpoHaptics.notificationAsync(type));
  },
};
