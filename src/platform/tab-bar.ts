import { Platform } from 'react-native';

/**
 * How the bottom navigation attaches to the window.
 *
 * - `floating` (iOS): a detached capsule over the content. Its material comes
 *   from `GlassSurface`, i.e. Apple's own — Liquid Glass on iOS 26+, the system
 *   blur below that. This is the shape iOS 26 gives its tab bar.
 * - `docked` (Android): a navigation bar that shares the bottom edge with the
 *   window, opaque and flat. Material does not blur its navigation bar; a
 *   translucent capsule floating over content is an iOS cue, so Android gets
 *   none of it.
 *
 * Kept here rather than in the component because AGENTS.md confines the
 * platform branch to `src/platform/` and asks the component to read a
 * capability instead.
 */
export type TabBarChrome = 'floating' | 'docked';

export const TAB_BAR_CHROME: TabBarChrome = Platform.OS === 'ios' ? 'floating' : 'docked';

interface ChromeMetrics {
  /** Height of the bar itself, excluding the bottom safe-area inset. */
  barHeight: number;
  /** Space between the bar and the home indicator (floating only). */
  gap: number;
  /** Breathing room a screen leaves below its content. */
  clearance: number;
}

export const TAB_BAR_METRICS: Record<TabBarChrome, ChromeMetrics> = {
  floating: { barHeight: 60, gap: 4, clearance: 24 },
  // 64 keeps the icon-plus-label stack comfortable without Material's extra
  // leading space; the docked bar still pads for the gesture inset itself.
  // Clearance is smaller than the floating bar's: the bar is opaque and
  // anchored, so content only needs to stop touching its divider.
  docked: { barHeight: 64, gap: 0, clearance: 12 },
};
