import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabAutomation, TabChat, TabExperts, TabMe } from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { useTokens } from '@/theme';

interface TabBarState {
  index: number;
  routes: { key: string; name: string }[];
}

const TAB_ICONS = {
  chat: { Icon: TabChat, w: 22, h: 20 },
  experts: { Icon: TabExperts, w: 21, h: 23 },
  automation: { Icon: TabAutomation, w: 18, h: 18 },
  me: { Icon: TabMe, w: 16, h: 21 },
} as const;

/**
 * Design tab bar wired to the navigator: 24px icon over a 10/20 label —
 * active = full-opacity Semibold, inactive = 30% Medium. Props are
 * structural so the bar stays decoupled from navigator internals.
 */
export function DesignTabBar({
  state,
  navigateToTab,
}: {
  state: TabBarState;
  navigateToTab: (routeKey: string) => void;
}) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={[styles.tabBar, { backgroundColor: t.bg, paddingBottom: Math.max(insets.bottom, 34) }]}
    >
      {state.routes.map((route, index) => {
        // The chat tab is the group's index route — normalize to its label.
        const name = (route.name === 'index' ? 'chat' : route.name) as keyof typeof TAB_ICONS;
        const meta = TAB_ICONS[name] ?? TAB_ICONS.chat;
        const label = strings.tabs[name];
        const isActive = state.index === index;
        const color = isActive ? t.textPrimary : t.textPlaceholder;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={styles.tab}
            onPress={() => {
              // Re-tapping the active tab pops its stack to the tab root.
              if (isActive) {
                router.back();
              } else {
                navigateToTab(route.key);
              }
            }}
          >
            <View style={styles.iconBox}>
              <meta.Icon width={meta.w} height={meta.h} color={color} />
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? t.textBody : t.textPlaceholder,
                  fontWeight: isActive ? '600' : '500',
                },
              ]}
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
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingLeft: 35,
    paddingRight: 36,
    gap: 64,
  },
  tab: {
    alignItems: 'center',
  },
  iconBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    lineHeight: 20,
  },
});
