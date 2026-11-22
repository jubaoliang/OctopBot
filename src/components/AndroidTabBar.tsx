import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Clock, MessageSquare, UserRound, Users } from 'lucide-react-native';

import { useI18n } from '@/i18n/I18nProvider';
import { countUnreadThreads } from '@/utils/count-unread';
import { UnreadDot } from '@/components/UnreadBadge';
import { useAppShell } from '@/features/app-shell';
import { useNotifications } from '@/features/notifications-context';
import { haptics } from '@/platform/haptics';
import { useKeyboardState } from '@/platform/keyboard';
import { ANDROID_TAB_BAR_HEIGHT } from '@/platform/tab-bar';
import { typeScale, useTokens } from '@/theme';

// Lucide glyphs at 24pt. Both states share one stroke; the tint is the only
// difference, as a chat app's bar does.
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

interface TabBarEmitter {
  emit(event: { type: 'tabPress'; target: string; canPreventDefault: true }): {
    defaultPrevented: boolean;
  };
}

/**
 * Android bottom navigation, in the shape chat apps use: a docked bar with an
 * icon and a label per tab, the current tab tinted with the accent and the
 * rest in the secondary text colour.
 *
 * No pill behind the icon, no ripple, no hover or press tint, no scale — the
 * bar answers a tap by switching, and that is the whole feedback. Selection
 * therefore reads from the colour alone, which is why the labels stay at full
 * contrast rather than dimming.
 */
export function AndroidTabBar({
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
  const { drawerPresented, drawerGroups } = useAppShell();
  const { liveUnread } = useNotifications();
  // The chat tab is the message surface: dot when any conversation has
  // server-reported unread, or an unconsumed live push arrived.
  const chatUnread = liveUnread || countUnreadThreads(drawerGroups) > 0;
  // Prefer height over isVisible: floating / zero-inset IMEs can report
  // visible while covering nothing.
  const keyboardHeight = useKeyboardState(state => state.height);

  // The bar is anchored, so it steps aside while the drawer or a real
  // (non-zero) IME owns the bottom edge.
  if (drawerPresented || keyboardHeight > 0) {
    return null;
  }

  return (
    <View
      accessibilityRole="tablist"
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
        const name = (route.name === 'chat' ? 'chat' : route.name) as keyof typeof TAB_ICONS;
        const Glyph = TAB_ICONS[name] ?? TAB_ICONS.chat;
        const label = strings.tabs[name];
        const isActive = state.index === index;
        // The default ink palette's accent IS ink, so tint alone cannot read
        // as selection; inactive drops to tertiary and active gains weight
        // and stroke so the cue survives monochrome palettes (HIG: never
        // colour-only).
        const fg = isActive ? t.accent : t.textTertiary;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            testID={`tab-${name}`}
            style={styles.item}
            onPress={() => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) {
                return;
              }
              if (!isActive) {
                haptics.selection();
              }
              // Navigating to the focused tab resolves to its root, so a
              // second tap returns the chat stack to the list.
              navigateToTab(route.key);
            }}
          >
            <View style={styles.glyphBox}>
              <Glyph
                size={TAB_GLYPH}
                color={fg}
                strokeWidth={isActive ? TAB_STROKE + 0.4 : TAB_STROKE}
              />
              {name === 'chat' && chatUnread ? (
                <View style={styles.unreadDot} pointerEvents="none">
                  <UnreadDot />
                </View>
              ) : null}
            </View>
            <Text
              style={[styles.label, { color: fg, fontWeight: isActive ? '600' : '400' }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  glyphBox: {
    width: TAB_GLYPH,
    height: TAB_GLYPH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -4,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: ANDROID_TAB_BAR_HEIGHT,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  label: {
    ...typeScale.caption2,
  },
});
