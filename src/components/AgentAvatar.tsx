import { StyleSheet, Text, View } from 'react-native';
import { Cloud, FileText, Terminal, Zap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

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

function tint(color: string | null | undefined, alpha: number): string {
  if (!color) {
    return `rgba(0,0,0,${alpha})`;
  }
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
  const Icon = iconName ? ICONS[iconName] : undefined;
  const fg = color ?? fallbackTextSecondary;
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color ? tint(color, 0.14) : 'rgba(0,0,0,0.04)',
        },
      ]}
    >
      {Icon ? (
        <Icon size={Math.round(size * 0.5)} color={fg} />
      ) : (
        <Text style={[styles.initial, { color: fg, fontSize: size * 0.42 }]}>
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
