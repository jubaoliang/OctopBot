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
 * Height of the system tab bar above the home indicator. iOS 26 floats the
 * bar over the content instead of reserving a strip for it, so screens still
 * have to keep their last row (and the composer) clear of it by hand.
 */
const IOS_TAB_BAR_HEIGHT = 56;
const IOS_TAB_BAR_CLEARANCE = 6;

/** Vertical space the bottom navigation takes out of the screen. */
export function useTabBarFootprint(): number {
  const insets = useSafeAreaInsets();
  if (NATIVE_TAB_BAR) {
    return Math.max(insets.bottom, 0) + IOS_TAB_BAR_HEIGHT + IOS_TAB_BAR_CLEARANCE;
  }
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 0) + TAB_BAR_CLEARANCE;
}
