import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Clock, MessageSquare, UserRound, Users } from 'lucide-react-native';

import { PressableScale } from '@/components/PressableScale';
import { useI18n } from '@/i18n/I18nProvider';
import { useAppShell } from '@/features/app-shell';
import { GlassSurface } from '@/platform/glass';
import { haptics } from '@/platform/haptics';
import { useKeyboardState } from '@/platform/keyboard';
import { TAB_BAR_CHROME, TAB_BAR_METRICS } from '@/platform/tab-bar';
import { continuousCorners, typeScale, useTokens } from '@/theme';

// Lucide glyphs at the bar's 24pt frame. A tab glyph is tinted, never filled:
// selection is carried by the tint and the indicator behind it, so the same
// stroke works for both states.
const TAB_ICONS = {
  chat: MessageSquare,
  experts: Users,
  automation: Clock,
  me: UserRound,
} as const;

const TAB_GLYPH = 24;
const TAB_STROKE = 1.9;

const METRICS = TAB_BAR_METRICS[TAB_BAR_CHROME];
const DOCKED = TAB_BAR_CHROME === 'docked';

interface TabBarState {
  index: number;
  routes: { key: string; name: string }[];
}

/** The slice of the navigator's event emitter the bar needs. */
interface TabBarEmitter {
  emit(event: { type: 'tabPress'; target: string; canPreventDefault: true }): {
    defaultPrevented: boolean;
  };
}

/** Vertical space the bar occupies — screens pad content by this. */
export function useTabBarFootprint(): number {
  const insets = useSafeAreaInsets();
  if (DOCKED) {
    // The bar shares the bottom edge, so the inset is padding inside it.
    return METRICS.barHeight + Math.max(insets.bottom, 0) + METRICS.clearance;
  }
  // Floating: inset + gap below the capsule + the capsule + clearance for its
  // shadow to read as floating.
  return Math.max(insets.bottom, 12) + METRICS.gap + METRICS.barHeight + METRICS.clearance;
}

/**
 * Bottom navigation.
 *
 * iOS keeps the floating capsule and gets its material from Apple — Liquid
 * Glass on iOS 26+, the system blur below it. Android gets a docked
 * navigation bar: opaque, flat, separated from content by a hairline, with the
 * selection shown as a pill behind the icon (Material's navigation bar). The
 * shape and material difference lives in `src/platform/tab-bar.ts`; this
 * component only reads it.
 */
export function DesignTabBar({
  state,
  emitter,
  navigateToTab,
}: {
  state: TabBarState;
  emitter: TabBarEmitter;
  navigateToTab: (routeKey: string) => void;
}) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const insets = useSafeAreaInsets();
  const { drawerPresented } = useAppShell();
  // Prefer height over isVisible: floating / zero-inset IMEs can report
  // visible while covering nothing, which would hide the tab bar for free.
  const keyboardHeight = useKeyboardState(state => state.height);
  const bottomOffset = DOCKED ? 0 : Math.max(insets.bottom, 12) + METRICS.gap;

  // Native glass layers above the drawer overlay; hide the bar until the
  // drawer has fully animated out so it never floats over drawer content.
  // Also hide while a real (non-zero) IME owns the bottom edge.
  if (drawerPresented || keyboardHeight > 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <GlassSurface
        variant="regular"
        style={[
          styles.bar,
          DOCKED
            ? [
                styles.docked,
                {
                  backgroundColor: t.surface,
                  borderTopColor: t.separator,
                  paddingBottom: Math.max(insets.bottom, 0),
                },
              ]
            : [
                styles.floating,
                {
                  marginBottom: bottomOffset,
                  shadowColor: t.shadow,
                  borderColor: t.borderSubtle,
                },
              ],
        ]}
      >
        {state.routes.map((route, index) => {
          // The chat tab hosts its own stack; route name maps to the label key.
          const name = (route.name === 'chat' ? 'chat' : route.name) as keyof typeof TAB_ICONS;
          const Glyph = TAB_ICONS[name] ?? TAB_ICONS.chat;
          const label = strings.tabs[name];
          const isActive = state.index === index;
          // A docked bar sits on an opaque surface, where a 30% placeholder
          // tint reads as disabled; the floating bar keeps the softer one.
          const fg = isActive ? t.accent : DOCKED ? t.textSecondary : t.textPlaceholder;

          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
              testID={`tab-${name}`}
              scaleTo={0.94}
              // Floating: the whole item is the selection capsule (the shape
              // iOS 26 gives a selected tab). Docked: the indicator hugs the
              // icon instead, as Material's navigation bar does.
              style={[styles.item, !DOCKED && isActive ? { backgroundColor: t.accentSoft } : null]}
              onPress={() => {
                // Ask the navigator first: a tab may want to hold the press
                // (scroll its list to the top, keep a draft, …).
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) {
                  return;
                }
                if (!isActive) {
                  // Same frame as the visual change (HIG: selection feedback).
                  haptics.selection();
                }
                // Re-tapping the focused tab navigates the tab to itself, and a
                // nested stack resolves that to its root — which is what "tap
                // the tab again" means. `router.back()` walked global history
                // instead, so from any other tab it landed on the first one.
                navigateToTab(route.key);
              }}
            >
              <View
                style={[
                  styles.iconBox,
                  DOCKED ? styles.indicator : null,
                  DOCKED && isActive ? { backgroundColor: t.accentSoft } : null,
                ]}
              >
                <Glyph size={TAB_GLYPH} color={fg} strokeWidth={TAB_STROKE} />
              </View>
              <Text
                style={[styles.label, { color: fg, fontWeight: isActive ? '600' : '500' }]}
                numberOfLines={1}
                // Bar chrome stays compact; the label is also the a11y label.
                maxFontSizeMultiplier={1.2}
              >
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    minHeight: METRICS.barHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  floating: {
    marginHorizontal: 16,
    borderRadius: 30,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
    // Soft float shadow; on Android elevation picks the color up.
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  docked: {
    // Shares the bottom edge with the window: no radius, no shadow, and a
    // hairline instead of a border all the way round.
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 48,
    borderRadius: 24,
    ...continuousCorners,
    paddingVertical: 6,
  },
  iconBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    width: 64,
    height: 32,
    borderRadius: 16,
  },
  label: {
    ...typeScale.caption2,
  },
});
