import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  cubicBezier,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { BookOpen, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { IconChevronDown, IconTaskWindow, LogoHeader, MenuTokens } from '@/components/icons';
import { AgentAvatar } from '@/components/AgentAvatar';
import { DrawerThreadRow } from '@/components/DrawerThreadRow';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { continuousCorners, layout, motion, radius, typeScale, useTokens } from '@/theme';

/** iOS sheet curve — the drawer is a sheet that enters from the leading edge. */
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/** Where a flick would come to rest (Apple's exponential-decay projection). */
function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
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
 * logo, nav rows (active = 4% overlay pill), 任务 section with agent
 * groups (40px indented children).
 *
 * One shared value (`progress`, 0 closed → 1 open) drives the panel and the
 * scrim, whether it is animating or under the finger: swipe left anywhere to
 * dismiss, and a flick is enough.
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
  const dragStart = useSharedValue(0);
  // True once a close has been committed (by tap, navigation or a swipe).
  // The pan ignores touches from then on: grabbing a closing drawer and
  // dragging it back open would leave it on screen while the app believes
  // it is closed.
  const closing = useSharedValue(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Set when the swipe gesture already started the closing spring, so the
  // `visible` effect does not restart it with a timing curve.
  const gestureClosing = useRef(false);

  useEffect(() => {
    if (visible) {
      gestureClosing.current = false;
      closing.set(false);
      progress.set(withTiming(1, { duration: motion.sheet, easing: EASE_SHEET }));
      return;
    }
    if (gestureClosing.current) {
      return;
    }
    closing.set(true);
    progress.set(
      withTiming(0, { duration: 240, easing: EASE_SHEET }, finished => {
        if (finished) {
          scheduleOnRN(onDismissed);
        }
      }),
    );
  }, [visible, progress, closing, onDismissed]);

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

  const closeFromGesture = useCallback(() => {
    gestureClosing.current = true;
    haptics.impact('light');
    onClose();
  }, [onClose]);

  const pan = usePanGesture({
    // Declare the axis so vertical scrolling of the task tree always wins.
    activeOffsetX: [-12, 12],
    failOffsetY: [-12, 12],
    onActivate: () => {
      'worklet';
      if (closing.get()) {
        return;
      }
      // Continue from where the eye last saw the panel, not from fully open.
      dragStart.set(progress.get());
    },
    onUpdate: event => {
      'worklet';
      if (closing.get()) {
        return;
      }
      const next = dragStart.get() + event.translationX / PANEL_WIDTH;
      progress.set(Math.min(1, Math.max(0, next)));
    },
    onDeactivate: event => {
      'worklet';
      if (closing.get()) {
        return;
      }
      const velocity = event.velocityX / PANEL_WIDTH;
      // Decide from the release event itself — the last onUpdate can trail
      // the finger by a frame or more, which under-reads a quick drag.
      const released = Math.min(1, Math.max(0, dragStart.get() + event.translationX / PANEL_WIDTH));
      const projected = released + project(event.velocityX) / PANEL_WIDTH;
      if (projected < 0.5) {
        closing.set(true);
        progress.set(
          withSpring(
            0,
            { duration: motion.sheet, dampingRatio: 1, velocity, overshootClamping: true },
            finished => {
              if (finished) {
                scheduleOnRN(onDismissed);
              }
            },
          ),
        );
        scheduleOnRN(closeFromGesture);
      } else {
        progress.set(
          withSpring(1, {
            duration: motion.sheet,
            dampingRatio: 1,
            velocity,
            overshootClamping: true,
          }),
        );
      }
    },
  });

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -PANEL_WIDTH * (1 - progress.get()) }],
  }));

  return (
    <GestureDetector gesture={pan}>
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
            { backgroundColor: t.bg, borderRightColor: t.borderSubtle },
            panelStyle,
          ]}
        >
          <ScrollView
            // Pin the content to the panel width — an unconstrained long
            // thread title otherwise widens the whole content container,
            // every row with it, and ellipsis never engages.
            contentContainerStyle={[
              styles.panelContent,
              {
                width: PANEL_WIDTH,
                // The design's 40pt top padding assumes a flat status bar;
                // clear the notch/Dynamic Island on notched devices.
                paddingTop: Math.max(40, insets.top + 8),
                paddingBottom: Math.max(20, insets.bottom + 16),
              },
            ]}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
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
              <View style={styles.tasksSection}>
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
                  <IconTaskWindow width={16} height={16} color={t.textTertiary} />
                </View>

                {groups.map(group => {
                  const expanded = collapsed[group.name] ?? group.expanded;
                  return (
                    <View key={group.agentId}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={group.name}
                        accessibilityState={{ expanded }}
                        style={({ pressed }) => [
                          styles.groupRow,
                          expanded ? { backgroundColor: t.overlaySubtle } : null,
                          pressed ? { backgroundColor: t.overlayPressed } : null,
                        ]}
                        onPress={() => {
                          setCollapsed(prev => ({ ...prev, [group.name]: !expanded }));
                          if (!expanded) {
                            onGroupPress(group);
                          }
                        }}
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
                      {expanded
                        ? group.items.map((item, index) => {
                            const title = item.title || strings.chat.newThread;
                            return (
                              <Animated.View
                                key={item.threadId}
                                entering={FadeInDown.delay(index * 20).duration(180)}
                                exiting={FadeOutUp.duration(120)}
                              >
                                <DrawerThreadRow
                                  thread={item}
                                  title={title}
                                  onOpen={() => onThreadPress(group, { ...item, title })}
                                  onPin={() => onThreadPin(group, item)}
                                  onDelete={() => onThreadDelete(group, item)}
                                />
                              </Animated.View>
                            );
                          })
                        : null}
                      {expanded && group.threadsLoaded && group.items.length === 0 ? (
                        <Animated.Text
                          entering={FadeIn.duration(150)}
                          exiting={FadeOut.duration(100)}
                          style={[styles.childEmpty, { color: t.textTertiary }]}
                        >
                          —
                        </Animated.Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </GestureDetector>
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
  onPress?: () => void;
  testID?: string;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !onPress }}
      accessibilityLabel={label}
      disabled={!onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.navRow,
        active ? { backgroundColor: t.overlaySubtle } : null,
        pressed ? { backgroundColor: t.overlayPressed } : null,
      ]}
      onPress={onPress}
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
  },
  panelContent: {
    paddingTop: 40,
    paddingBottom: 20,
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
    marginTop: 12,
    gap: 2,
    paddingHorizontal: 12,
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
