import { StyleSheet, Text, View } from 'react-native';

import { EXPERT_ICONS } from '@/components/expert-icons';
import { UI_FONT, useTokens } from '@/theme';
import { tintHex } from '@/utils/color';

/**
 * Expert avatar: the agent's brand color as a soft tile with its
 * lucide icon (server `icon_name`), initial letter as the fallback.
 */
export function AgentAvatar({
  name,
  iconName,
  color,
  size = 36,
  fallbackTextSecondary,
}: {
  name: string;
  iconName?: string | null;
  color?: string | null;
  size?: number;
  /** Text color for the fallback initial when no brand color exists. */
  fallbackTextSecondary: string;
}) {
  const t = useTokens();
  const Icon = iconName ? EXPERT_ICONS[iconName] : undefined;
  // An unparseable brand color falls back to the neutral token pair, which
  // also keeps the tile visible in dark mode.
  const brandTint = tintHex(color, 0.14);
  const fg = brandTint && color ? color : fallbackTextSecondary;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: brandTint ?? t.overlaySubtle,
        },
      ]}
    >
      {Icon ? (
        <Icon size={Math.round(size * 0.5)} color={fg} />
      ) : (
        <Text
          allowFontScaling={false}
          style={[styles.initial, { color: fg, fontSize: size * 0.42 }]}
        >
          {name.slice(0, 1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: UI_FONT,
    fontWeight: '600',
    lineHeight: undefined,
  },
});
