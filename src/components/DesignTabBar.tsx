import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Clock, MessageSquare, UserRound, Users } from 'lucide-react-native';

import { PressableScale } from '@/components/PressableScale';
import { useI18n } from '@/i18n/I18nProvider';
import { useAppShell } from '@/features/app-shell';
import { GlassSurface } from '@/platform/glass';
import { haptics } from '@/platform/haptics';
import { useKeyboardState } from '@/platform/keyboard';
import { continuousCorners, typeScale, useTokens } from '@/theme';

// Lucide glyphs at the bar's 24pt frame. A tab glyph is tinted, never filled:
// selection is carried by the accent tint and the pill behind it, so the same
// stroke works for both states.
const TAB_ICONS = {
  chat: MessageSquare,
  experts: Users,
  automation: Clock,
  me: UserRound,
} as const;

const TAB_GLYPH = 24;
const TAB_STROKE = 1.9;

const PILL_HEIGHT = 60;

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

/** Vertical space the floating bar occupies — screens pad content by this. */
export function useTabBarFootprint(): number {
  const insets = useSafeAreaInsets();
  // 24pt of breathing room between content (e.g. the composer) and the
  // floating pill — the pill's shadow needs clearance to read as floating.
  return Math.max(insets.bottom, 12) + 4 + PILL_HEIGHT + 24;
}

/**
 * Floating glass tab bar (hard requirement #1): Liquid Glass on iOS 26+
 * via the platform wrapper, blur approximation below, opaque surface on
 * Android per the Ardot design. Active item tints with the accent palette.
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
  const bottomOffset = Math.max(insets.bottom, 12) + 4;

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
          styles.pill,
          { marginBottom: bottomOffset, shadowColor: t.shadow, borderColor: t.borderSubtle },
        ]}
      >
        {state.routes.map((route, index) => {
          // The chat tab hosts its own stack; route name maps to the label key.
          const name = (route.name === 'chat' ? 'chat' : route.name) as keyof typeof TAB_ICONS;
          const Glyph = TAB_ICONS[name] ?? TAB_ICONS.chat;
          const label = strings.tabs[name];
          const isActive = state.index === index;
          const fg = isActive ? t.accent : t.textPlaceholder;

          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
              testID={`tab-${name}`}
              scaleTo={0.94}
              style={[styles.item, isActive ? { backgroundColor: t.accentSoft } : null]}
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
              <View style={styles.iconBox}>
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
  pill: {
    marginHorizontal: 16,
    minHeight: PILL_HEIGHT,
    borderRadius: 30,
    ...continuousCorners,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    // Soft float shadow; on Android elevation picks the color up.
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
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
  label: {
    ...typeScale.caption2,
  },
});
