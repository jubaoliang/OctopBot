import { StyleSheet, Text, View } from 'react-native';
import { Cloud, FileText, Terminal, Zap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTokens } from '@/theme';
import { tintHex } from '@/utils/color';

/**
 * Named-import map for the icon set Octop's expert templates use
 * (lucide names from the server's manifest). Unknown names fall back
 * to the agent's initial — add mappings as new templates land.
 */
const ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  terminal: Terminal,
  cloud: Cloud,
  'file-text': FileText,
};

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
  const Icon = iconName ? ICONS[iconName] : undefined;
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
    fontWeight: '600',
    lineHeight: undefined,
  },
});
