import {
  BackHandler,
  type GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Animated, {
  Easing,
  cubicBezier,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BookOpen, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { IconChevronDown, LogoHeader, MenuTokens } from '@/components/icons';
import { AgentAvatar } from '@/components/AgentAvatar';
import { Collapsible } from '@/components/Collapsible';
import { DrawerThreadRow } from '@/components/DrawerThreadRow';
import { useI18n } from '@/i18n/I18nProvider';
import { continuousCorners, layout, motion, radius, typeScale, useTokens } from '@/theme';

/** iOS sheet curve — the drawer is a sheet that enters from the leading edge. */
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/** A touch that travels further than this (pt) is a drag, not a tap. */
const TAP_SLOP = 10;

/**
 * Press handlers for a drawer row that only fire for a real tap.
 *
 * The panel does not move under a sideways drag, and a vertical-only scroll
 * view does not claim one either — so without this a swipe across a row
 * that ends inside it would count as a press and navigate.
 */
function useTap(onTap: () => void) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  return {
    onPressIn: (event: GestureResponderEvent) => {
      origin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    },
    onPress: (event: GestureResponderEvent) => {
      // No origin means the press did not come from a touch (accessibility
      // activation, keyboard) — those always count.
      const from = origin.current;
      origin.current = null;
      if (
        from &&
        Math.hypot(event.nativeEvent.pageX - from.x, event.nativeEvent.pageY - from.y) > TAP_SLOP
      ) {
        return;
      }
      onTap();
    },
  };
}

/** Chevron that turns with the expand state (UI-thread CSS transition). */
function Chevron({ expanded, color }: { expanded: boolean; color: string }) {
  return (
    <Animated.View
      style={[chevronTransition, { transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }]}
    >
      <IconChevronDown width={16} height={16} color={color} />
    </Animated.View>
  );
}

export interface DrawerThread {
  threadId: string;
  /** Server title; empty when the conversation has none yet. */
  title: string;
  pinned: boolean;
}

export interface DrawerTaskGroup {
  name: string;
  agentId: string;
  items: DrawerThread[];
  expanded: boolean;
  /** True once this group's threads have been fetched. */
  threadsLoaded?: boolean;
  /** Server-side expert identity (lucide icon name + brand color). */
  iconName?: string | null;
  color?: string | null;
}

export type DrawerRoute = 'knowledge' | 'usage' | 'settings';

interface AppDrawerProps {
  /** Requested state; the drawer animates toward it. */
  visible: boolean;
  onClose: () => void;
  /** Fired once the close animation has finished — the parent unmounts then. */
  onDismissed: () => void;
  /** The secondary route that should read as selected. */
  activeRoute: DrawerRoute | null;
  onNavigate: (route: DrawerRoute) => void;
  /** Task tree = agent groups with their threads. */
  groups: DrawerTaskGroup[];
  /** First expand of a group fetches its threads. */
  onGroupPress: (group: DrawerTaskGroup) => void;
  /** Opens an existing conversation. */
  onThreadPress: (group: DrawerTaskGroup, thread: DrawerThread) => void;
  onThreadPin: (group: DrawerTaskGroup, thread: DrawerThread) => void;
  onThreadDelete: (group: DrawerTaskGroup, thread: DrawerThread) => void;
}

const PANEL_WIDTH = 313;

// Reanimated CSS transition; not in StyleSheet.create (core style types do
// not know Reanimated's easing objects).
const chevronTransition = {
  transitionProperty: 'transform',
  transitionDuration: motion.state,
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const;

/**
 * Left drawer per design: 40% scrim, 313-wide panel on tokens.bg —
 * fixed logo + nav rows, then a 任务 section whose group list alone scrolls
 * (40px indented thread children). Open/close is `visible` timing plus
 * scrim tap / Android back — no pan-to-drag on the panel.
 */
export function AppDrawer({
  visible,
  onClose,
  onDismissed,
  activeRoute,
  onNavigate,
  groups,
  onGroupPress,
  onThreadPress,
  onThreadPin,
  onThreadDelete,
}: AppDrawerProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) {
      progress.set(withTiming(1, { duration: motion.sheet, easing: EASE_SHEET }));
      return;
    }
    progress.set(
      withTiming(0, { duration: 240, easing: EASE_SHEET }, finished => {
        if (finished) {
          scheduleOnRN(onDismissed);
        }
      }),
    );
  }, [visible, progress, onDismissed]);

  // Android hardware back closes the drawer before it leaves the screen.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  // Scrim and panel are both driven by compositor-only props (opacity,
  // transform) off the one shared value, so they land in the same frame.
  // Never animate a layout prop here: it is committed on a different path
  // and trails the transform, which opens a seam between the two.
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -PANEL_WIDTH * (1 - progress.get()) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: t.scrim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={strings.a11y.closeMenu}
          testID="drawer-scrim"
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.panel,
          {
            backgroundColor: t.bg,
            borderRightColor: t.borderSubtle,
            // Design's 40pt top assumes a flat status bar; clear the notch.
            paddingTop: Math.max(40, insets.top + 8),
            paddingBottom: Math.max(20, insets.bottom + 16),
          },
          panelStyle,
        ]}
      >
        {/* Fixed chrome — only the task groups below scroll. */}
        <View style={styles.logoRow}>
          <LogoHeader width={62} height={21} color={t.textBody} />
        </View>

        <View style={styles.menuList}>
          <NavRow
            icon={<BookOpen size={20} color={t.textBody} />}
            label={strings.drawer.knowledge}
            active={activeRoute === 'knowledge'}
            testID="drawer-knowledge"
            onPress={() => onNavigate('knowledge')}
          />
          <NavRow
            icon={<MenuTokens width={20} height={20} color={t.textBody} />}
            label={strings.drawer.tokens}
            active={activeRoute === 'usage'}
            testID="drawer-tokens"
            onPress={() => onNavigate('usage')}
          />
          <NavRow
            icon={<Settings size={20} color={t.textBody} />}
            label={strings.drawer.settings}
            active={activeRoute === 'settings'}
            testID="drawer-settings"
            onPress={() => onNavigate('settings')}
          />
        </View>

        {groups.length > 0 ? (
          <View style={styles.tasksSection} testID="drawer-tasks">
            <View style={styles.tasksHeader}>
              <View style={styles.tasksHeaderLeft}>
                <Text
                  accessibilityRole="header"
                  style={[styles.tasksTitle, { color: t.textTertiary }]}
                >
                  {strings.drawer.tasks}
                </Text>
                <IconChevronDown width={16} height={16} color={t.textTertiary} />
              </View>
            </View>

            <ScrollView
              style={styles.tasksScroll}
              // Content width follows the scroll view — a fixed 313pt pin
              // was a hairline wider than the bordered viewport and let
              // iOS rubber-band the whole panel sideways.
              alwaysBounceHorizontal={false}
              contentContainerStyle={styles.tasksScrollContent}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              {groups.map(group => {
                const expanded = collapsed[group.name] ?? group.expanded;
                return (
                  <View key={group.agentId}>
                    <GroupRow
                      group={group}
                      expanded={expanded}
                      onPress={() => {
                        setCollapsed(prev => ({ ...prev, [group.name]: !expanded }));
                        if (!expanded) {
                          onGroupPress(group);
                        }
                      }}
                    />
                    <Collapsible expanded={expanded}>
                      {group.items.map(item => {
                        const title = item.title || strings.chat.newThread;
                        return (
                          <DrawerThreadRow
                            key={item.threadId}
                            thread={item}
                            title={title}
                            onOpen={() => onThreadPress(group, { ...item, title })}
                            onPin={() => onThreadPin(group, item)}
                            onDelete={() => onThreadDelete(group, item)}
                          />
                        );
                      })}
                      {group.threadsLoaded && group.items.length === 0 ? (
                        <Text style={[styles.childEmpty, { color: t.textTertiary }]}>—</Text>
                      ) : null}
                    </Collapsible>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Agent group header: avatar, name and the disclosure chevron. */
function GroupRow({
  group,
  expanded,
  onPress,
}: {
  group: DrawerTaskGroup;
  expanded: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  const tap = useTap(onPress);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={group.name}
      accessibilityState={{ expanded }}
      testID={`drawer-group-${group.agentId}`}
      style={({ pressed }) => [
        styles.groupRow,
        expanded ? { backgroundColor: t.overlaySubtle } : null,
        pressed ? { backgroundColor: t.overlayPressed } : null,
      ]}
      {...tap}
    >
      <AgentAvatar
        name={group.name}
        iconName={group.iconName}
        color={group.color}
        size={20}
        fallbackTextSecondary={t.textBody}
      />
      <Text
        style={[styles.groupName, { color: t.textBody }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {group.name}
      </Text>
      <Chevron expanded={expanded} color={t.textTertiary} />
    </Pressable>
  );
}

function NavRow({
  icon,
  label,
  active = false,
  onPress,
  testID,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTokens();
  const tap = useTap(onPress);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.navRow,
        active ? { backgroundColor: t.overlaySubtle } : null,
        pressed ? { backgroundColor: t.overlayPressed } : null,
      ]}
      {...tap}
    >
      {icon}
      <Text style={[styles.navLabel, { color: t.textBody }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  logoRow: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  menuList: {
    paddingHorizontal: 12,
    gap: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: layout.rowMinHeight,
    borderRadius: radius.pill,
    ...continuousCorners,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navLabel: {
    ...typeScale.body,
    fontWeight: '500',
    flex: 1,
  },
  tasksSection: {
    // Design Frame 2147231496: section gap 4; rows carry their own rhythm.
    flex: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    minHeight: 0,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tasksHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tasksTitle: {
    ...typeScale.footnote,
  },
  tasksScroll: {
    flex: 1,
  },
  tasksScrollContent: {
    width: '100%',
    gap: 2,
    paddingBottom: 8,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: layout.rowMinHeight,
    borderRadius: radius.pill,
    ...continuousCorners,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupName: {
    flex: 1,
    ...typeScale.body,
  },
  childEmpty: {
    paddingLeft: 40,
    paddingVertical: 8,
    ...typeScale.callout,
  },
});
