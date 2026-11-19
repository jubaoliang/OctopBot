import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much room screens must leave for the tab bar.
 *
 * Both platforms use the system bar (`NativeTabs`). Android's Material bottom
 * navigation is docked and takes its height out of the screen, so content
 * already ends above it. iOS 26 floats the bar over the content, so the strip
 * has to be reserved by the screen itself.
 */

/**
 * Height of the system tab bar above the home indicator (UITabBar is 49pt;
 * iOS 26 draws it floating over the content, so the screen still reserves the
 * strip itself). No extra clearance: the composer already carries its own
 * padding, and a second gap reads as an empty band under it.
 */
const IOS_TAB_BAR_HEIGHT = 49;

/** Vertical space the bottom navigation takes out of the screen. */
export function useTabBarFootprint(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'ios') {
    return Math.max(insets.bottom, 0) + IOS_TAB_BAR_HEIGHT;
  }
  // Docked: the bar is part of the screen's layout, not an overlay.
  return 0;
}
