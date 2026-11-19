import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much room screens must leave for the tab bar.
 *
 * iOS uses the system bar (`NativeTabs`): a screen inside a UITabBarController
 * already reports the bar in its own safe-area inset, so it only adds the
 * clearance above the bar's glass. Android's Material bottom navigation is
 * docked and takes its height out of the screen — except for our drawn bar,
 * which is anchored over the content, so screens reserve it themselves.
 */

/**
 * Clearance above iOS' system tab bar. The inset a tab screen receives covers
 * the bar's 49pt frame plus the home indicator; the floating glass draws a few
 * points above that frame, so this keeps the composer just clear of it. No more
 * than that: a bar-height's worth of extra padding read as an empty band under
 * the composer.
 */
const IOS_TAB_BAR_CLEARANCE = 8;

/** Height of the drawn Android bar above the gesture inset. */
export const ANDROID_TAB_BAR_HEIGHT = 56;

/**
 * Breathing room above the drawn Android bar. The bar is an opaque strip with
 * a hairline on top, so a composer sitting exactly on it reads as attached to
 * the chrome; the inset keeps the two apart.
 */
const ANDROID_TAB_BAR_CLEARANCE = 12;

/** Vertical space the bottom navigation takes out of the screen. */
export function useTabBarFootprint(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'ios') {
    return Math.max(insets.bottom, 0) + IOS_TAB_BAR_CLEARANCE;
  }
  // The drawn bar is anchored over the content, so screens reserve it.
  return ANDROID_TAB_BAR_HEIGHT + Math.max(insets.bottom, 0) + ANDROID_TAB_BAR_CLEARANCE;
}
