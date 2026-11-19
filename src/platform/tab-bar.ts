import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * True when the tab bar is the platform's own rather than `DesignTabBar`.
 *
 * iOS renders `expo-router`'s `NativeTabs`, i.e. the system `UITabBar`. A
 * system bar sizes itself out of the screen area, so screens must not reserve
 * space for it. Android draws the docked bar itself and does.
 */
export const NATIVE_TAB_BAR = Platform.OS === 'ios';

/** Height of the docked Android bar, excluding the bottom inset. */
export const TAB_BAR_HEIGHT = 64;

/** Gap a screen leaves between its content and the docked bar's divider. */
export const TAB_BAR_CLEARANCE = 12;

/**
 * Height of the system tab bar above the home indicator (UITabBar is 49pt;
 * iOS 26 draws it floating over the content, so the screen still reserves the
 * strip itself). No extra clearance: the composer already carries its own
 * padding, and a second gap reads as an empty band under it.
 */
const IOS_TAB_BAR_HEIGHT = 49;
const IOS_TAB_BAR_CLEARANCE = 0;

/** Vertical space the bottom navigation takes out of the screen. */
export function useTabBarFootprint(): number {
  const insets = useSafeAreaInsets();
  if (NATIVE_TAB_BAR) {
    return Math.max(insets.bottom, 0) + IOS_TAB_BAR_HEIGHT + IOS_TAB_BAR_CLEARANCE;
  }
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 0) + TAB_BAR_CLEARANCE;
}
