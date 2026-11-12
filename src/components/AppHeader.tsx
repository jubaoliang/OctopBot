import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { IconHamburger, IconKebab, LogoHeader } from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { layout, typeScale, useTokens } from '@/theme';

interface AppHeaderProps {
  /** Center content: app logo (default) or title + optional subtitle. */
  title?: string;
  subtitle?: string;
  onMenu?: () => void;
  onMore?: () => void;
}

/**
 * Mobile header per design: hamburger / centered logo-or-title / kebab.
 * The 20pt glyphs keep the design's 16pt optical margin but sit in 44pt
 * touch frames (HIG); the bar grows with Dynamic Type instead of clipping.
 */
export function AppHeader({ title, subtitle, onMenu, onMore }: AppHeaderProps) {
  const t = useTokens();
  const { t: strings } = useI18n();

  return (
    <View style={styles.header}>
      <IconButton label={strings.a11y.menu} testID="header-menu" onPress={onMenu}>
        <IconHamburger width={20} height={20} color={t.textBody} />
      </IconButton>

      {title ? (
        <View style={styles.titleStack}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: t.textPrimary }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: t.textTertiary }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : (
        <View accessible accessibilityRole="header" accessibilityLabel={strings.appName}>
          <LogoHeader width={60} height={20} color={t.textBody} />
        </View>
      )}

      <IconButton label={strings.a11y.more} testID="header-more" onPress={onMore}>
        <IconKebab width={20} height={20} color={t.textBody} />
      </IconButton>
    </View>
  );
}

// Glyph (20) centered in a 44pt frame leaves 12pt inside the frame, so a
// 4pt bar inset lands the glyph edge on the 16pt screen margin.
const BAR_INSET = layout.screenMargin - (layout.hitTarget - 20) / 2;

const styles = StyleSheet.create({
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BAR_INSET,
    paddingVertical: 4,
    gap: 8,
  },
  titleStack: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typeScale.headline,
  },
  subtitle: {
    ...typeScale.footnote,
  },
});
