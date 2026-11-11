import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Path, Svg } from 'react-native-svg';

import {
  IconChevronDown,
  IconTaskWindow,
  LogoDrawer,
  MenuAutomation,
  MenuChat,
  MenuExperts,
  MenuTokens,
} from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { useTokens } from '@/theme';

export interface DrawerThread {
  threadId: string;
  title: string;
}

export interface DrawerTaskGroup {
  name: string;
  agentId: string;
  items: DrawerThread[];
  expanded: boolean;
  /** True once this group's threads have been fetched. */
  threadsLoaded?: boolean;
}

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  /** Drawer nav mirrors the tab bar routes; Token 统计 is drawer-only. */
  onNavigate: (route: 'chat' | 'experts' | 'automation') => void;
  /** Task tree = agent groups with their threads. */
  groups: DrawerTaskGroup[];
  /** First expand of a group fetches its threads. */
  onGroupPress: (group: DrawerTaskGroup) => void;
  /** Opens an existing conversation. */
  onThreadPress: (group: DrawerTaskGroup, thread: DrawerThread) => void;
}

const PANEL_WIDTH = 313;

/**
 * Left drawer per design: 40% scrim, 313-wide panel on tokens.bg —
 * logo, nav rows (active = 4% overlay pill), 任务 section with agent
 * groups (40px indented children), profile row at the end.
 */
export function AppDrawer({
  visible,
  onClose,
  onNavigate,
  groups,
  onGroupPress,
  onThreadPress,
}: AppDrawerProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, progress]);

  // The parent mounts this component only while open, so no display
  // toggling here — opacity alone drives the fade.
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -PANEL_WIDTH * (1 - progress.value) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: t.scrim }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="close menu"
      />
      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: t.bg, borderRightColor: t.borderSubtle },
          panelStyle,
        ]}
      >
        <ScrollView
          contentContainerStyle={[
            styles.panelContent,
            // The design's 40pt top padding assumes a flat status bar;
            // clear the notch/Dynamic Island on notched devices.
            { paddingTop: Math.max(40, insets.top + 8) },
          ]}
          bounces={false}
        >
          <View style={styles.logoRow}>
            <LogoDrawer width={62} height={21} color={t.textBody} />
          </View>

          <View style={styles.menuList}>
            <NavRow
              icon={<MenuChat width={20} height={20} color={t.textBody} />}
              label={strings.tabs.chat}
              active
              onPress={() => onNavigate('chat')}
            />
            <NavRow
              icon={<MenuExperts width={20} height={20} color={t.textBody} />}
              label={strings.tabs.experts}
              onPress={() => onNavigate('experts')}
            />
            <NavRow
              icon={<MenuAutomation width={20} height={20} color={t.textBody} />}
              label={strings.tabs.automation}
              onPress={() => onNavigate('automation')}
            />
            <NavRow
              icon={<MenuTokens width={20} height={20} color={t.textBody} />}
              label={strings.drawer.tokens}
            />
          </View>

          <View style={styles.tasksSection}>
            <View style={styles.tasksHeader}>
              <View style={styles.tasksHeaderLeft}>
                <Text style={[styles.tasksTitle, { color: t.textTertiary }]}>
                  {strings.drawer.tasks}
                </Text>
                <IconChevronDown width={16} height={16} color={t.textTertiary} />
              </View>
              <IconTaskWindow width={16} height={16} color={t.textTertiary} />
            </View>

            {groups.map(group => {
              const expanded = group.expanded !== collapsed[group.name];
              return (
                <View key={group.agentId} style={styles.groupWrap}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={group.name}
                    style={[
                      styles.groupRow,
                      expanded ? { backgroundColor: t.overlaySubtle } : null,
                    ]}
                    onPress={() => {
                      setCollapsed(prev => ({ ...prev, [group.name]: expanded }));
                      onGroupPress(group);
                    }}
                  >
                    <PersonGlyph color={t.textBody} />
                    <Text style={[styles.groupName, { color: t.textBody }]} numberOfLines={1}>
                      {group.name}
                    </Text>
                    <Animated.View
                      style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}
                    >
                      <IconChevronDown width={16} height={16} color={t.textTertiary} />
                    </Animated.View>
                  </Pressable>
                  {expanded
                    ? group.items.map(item => (
                        <Pressable
                          key={item.threadId}
                          accessibilityRole="button"
                          accessibilityLabel={item.title}
                          style={({ pressed }) => [
                            styles.childRow,
                            pressed ? { opacity: 0.6 } : null,
                          ]}
                          onPress={() => onThreadPress(group, item)}
                        >
                          <Text style={[styles.childName, { color: t.textBody }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                        </Pressable>
                      ))
                    : null}
                  {expanded && group.threadsLoaded && group.items.length === 0 ? (
                    <Text style={[styles.childEmpty, { color: t.textTertiary }]}>—</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

function NavRow({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      style={[styles.navRow, active ? { backgroundColor: t.overlaySubtle, borderRadius: 8 } : null]}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.navLabel, { color: t.textBody }]}>{label}</Text>
    </Pressable>
  );
}

/** 20px person-in-circle glyph (design's generic identity icon). */
function PersonGlyph({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="9" stroke={color} strokeWidth="1.5" fill="none" />
      <Circle cx="10" cy="8" r="3" stroke={color} strokeWidth="1.5" fill="none" />
      <Path d="M4.5 16a6 6 0 0 1 11 0" stroke={color} strokeWidth="1.5" fill="none" />
    </Svg>
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
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  menuList: {
    paddingHorizontal: 12,
    gap: 0,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  tasksSection: {
    marginTop: 24,
    gap: 12,
    paddingHorizontal: 12,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 4,
  },
  tasksHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tasksTitle: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  groupWrap: {
    marginBottom: 2,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  childRow: {
    paddingHorizontal: 40,
    paddingVertical: 10,
  },
  childEmpty: {
    paddingHorizontal: 40,
    paddingVertical: 8,
    fontSize: 13,
  },
  childName: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
});
