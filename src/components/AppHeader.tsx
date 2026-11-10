import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconHamburger, IconKebab, LogoHeader } from '@/components/icons';
import { useTokens } from '@/theme';

interface AppHeaderProps {
  /** Center content: app logo (default) or title + optional subtitle. */
  title?: string;
  subtitle?: string;
  onMenu?: () => void;
  onMore?: () => void;
}

/**
 * Mobile header per design: hamburger / centered logo-or-title / kebab.
 * Frame: 375w, padding 16/8, item gap 24, height 52.
 */
export function AppHeader({ title, subtitle, onMenu, onMore }: AppHeaderProps) {
  const t = useTokens();

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="menu"
        onPress={onMenu}
        style={styles.iconButton}
      >
        <IconHamburger width={20} height={20} color={t.textBody} />
      </Pressable>

      {title ? (
        <View style={styles.titleStack}>
          <Text style={[styles.title, { color: t.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: t.textTertiary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : (
        <LogoHeader width={60} height={20} color={t.textBody} />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="more"
        onPress={onMore}
        style={styles.iconButton}
      >
        <IconKebab width={20} height={20} color={t.textBody} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleStack: {
    alignItems: 'center',
    gap: 0,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
});
