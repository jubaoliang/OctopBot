import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';

import { useTheme } from '@/theme';

export type GlassVariant = 'regular' | 'clear';

interface GlassSurfaceProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: GlassVariant;
}

let liquidGlassChecked = false;
let liquidGlassAvailable = false;

function supportsLiquidGlass(): boolean {
  if (!liquidGlassChecked) {
    liquidGlassChecked = true;
    liquidGlassAvailable = Platform.OS === 'ios' && isLiquidGlassAvailable();
  }
  return liquidGlassAvailable;
}

/**
 * Platform glass surface — the ONLY place expo-glass-effect / expo-blur are
 * imported (AGENTS.md wrapper hygiene; HarmonyOS shim swaps this module).
 *
 * - iOS 26+: Apple Liquid Glass via expo-glass-effect, following the app's
 *   own light/dark theme (not just the OS setting).
 * - iOS < 26: expo-blur approximation.
 * - Android: opaque surface per the Ardot design (Material stays standard).
 */
export function GlassSurface({ children, style, variant = 'regular' }: GlassSurfaceProps) {
  const { resolvedMode: mode, tokens } = useTheme();

  // Android per the design (Material, opaque surface); also covers web and
  // any future platform where neither glass implementation applies.
  if (Platform.OS !== 'ios') {
    return <View style={[{ backgroundColor: tokens.surface }, style]}>{children}</View>;
  }

  if (supportsLiquidGlass()) {
    return (
      <GlassView glassEffectStyle={variant} colorScheme={mode} style={style}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={40} tint={mode} style={style}>
      {children}
    </BlurView>
  );
}
