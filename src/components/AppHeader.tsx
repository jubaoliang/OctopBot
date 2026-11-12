import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { IconButton } from '@/components/IconButton';
import { IconHamburger, IconKebab, LogoHeader } from '@/components/icons';
import { OverflowMenu, type OverflowMenuItem } from '@/components/OverflowMenu';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { layout, typeScale, useTokens } from '@/theme';

interface AppHeaderProps {
  /** Center content: app logo (default) or title + optional subtitle. */
  title?: string;
  subtitle?: string;
  onMenu?: () => void;
  /** Pushed screens pass this: a back chevron replaces the menu button. */
  onBack?: () => void;
  /**
   * Custom overflow presenter. Prefer `moreItems` — the kebab stays hidden
   * until one of these is passed with real actions.
   */
  onMore?: () => void;
  /** Overflow actions. The kebab is shown only when this list is non-empty. */
  moreItems?: OverflowMenuItem[];
}

/**
 * Mobile header per design: hamburger / centered logo-or-title / kebab.
 * The 20pt glyphs keep the design's 16pt optical margin but sit in 44pt
 * touch frames (HIG); the bar grows with Dynamic Type instead of clipping.
 *
 * The trailing kebab is omitted until a screen has real overflow actions.
 */
export function AppHeader({ title, subtitle, onMenu, onBack, onMore, moreItems }: AppHeaderProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = moreItems ?? [];
  const showMore = Boolean(onMore) || items.length > 0;

  const openMore = () => {
    if (onMore) {
      onMore();
      return;
    }
    haptics.selection();
    setMenuOpen(true);
  };

  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton label={strings.a11y.back} testID="header-back" onPress={onBack}>
          <ChevronLeft size={26} color={t.textBody} />
        </IconButton>
      ) : (
        <IconButton label={strings.a11y.menu} testID="header-menu" onPress={onMenu}>
          <IconHamburger width={20} height={20} color={t.textBody} />
        </IconButton>
      )}

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

      {showMore ? (
        <IconButton label={strings.a11y.more} testID="header-more" onPress={openMore}>
          <IconKebab width={20} height={20} color={t.textBody} />
        </IconButton>
      ) : (
        // Same footprint as the button, so the title stays centered.
        <View style={styles.trailingSpacer} />
      )}

      {items.length > 0 ? (
        <OverflowMenu
          visible={menuOpen}
          items={items}
          dismissLabel={strings.a11y.closeMenu}
          onClose={() => {
            setMenuOpen(false);
          }}
        />
      ) : null}
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
  trailingSpacer: {
    width: layout.hitTarget,
    height: layout.hitTarget,
  },
  title: {
    ...typeScale.headline,
  },
  subtitle: {
    ...typeScale.footnote,
  },
});
