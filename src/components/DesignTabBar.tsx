import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Clock, MessageSquare, UserRound, Users } from 'lucide-react-native';

import { PressableScale } from '@/components/PressableScale';
import { useI18n } from '@/i18n/I18nProvider';
import { useAppShell } from '@/features/app-shell';
import { haptics } from '@/platform/haptics';
import { useKeyboardState } from '@/platform/keyboard';
import { TAB_BAR_HEIGHT } from '@/platform/tab-bar';
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

/**
 * Bottom navigation for targets without a system tab bar (Android today).
 *
 * A docked navigation bar: it shares the bottom edge with the window, sits on
 * an opaque surface behind a hairline divider, and shows the selection as a
 * pill behind the icon. No blur, no translucency, no floating capsule — those
 * are iOS cues and iOS renders its own bar (`tabs-shell.ios.tsx`).
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

  // The bar is anchored, so it must step aside while the drawer or a real
  // (non-zero) IME owns the bottom edge.
  if (drawerPresented || keyboardHeight > 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.bar,
        {
          backgroundColor: t.surface,
          borderTopColor: t.separator,
          paddingBottom: Math.max(insets.bottom, 0),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        // The chat tab hosts its own stack; route name maps to the label key.
        const name = (route.name === 'chat' ? 'chat' : route.name) as keyof typeof TAB_ICONS;
        const Glyph = TAB_ICONS[name] ?? TAB_ICONS.chat;
        const label = strings.tabs[name];
        const isActive = state.index === index;
        const fg = isActive ? t.accent : t.textSecondary;

        return (
          <PressableScale
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            testID={`tab-${name}`}
            scaleTo={0.94}
            style={styles.item}
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
            <View style={[styles.indicator, isActive ? { backgroundColor: t.accentSoft } : null]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    // Shares the bottom edge with the window: a hairline instead of a border
    // all the way round, and no radius or shadow.
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 48,
    paddingVertical: 6,
  },
  indicator: {
    width: 64,
    height: 32,
    borderRadius: 16,
    ...continuousCorners,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typeScale.caption2,
  },
});
