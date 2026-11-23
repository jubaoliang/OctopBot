import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { useTokens } from '@/theme';

// One opacity wave passed along three dots (UI-thread CSS animation).
const wave = {
  animationName: {
    '0%': { opacity: 0.25 },
    '40%': { opacity: 1 },
    '80%': { opacity: 0.25 },
    '100%': { opacity: 0.25 },
  },
  animationDuration: 1100,
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-in-out',
} as const;

const DELAYS = [0, 160, 320] as const;

/**
 * "The expert is replying" indicator shown between the user's turn and the
 * first streamed token. Under Reduce Motion the dots hold a steady dim — an
 * opacity wave that never ends is exactly the motion the setting removes.
 */
export function TypingDots({ label }: { label: string }) {
  const t = useTokens();
  const reduceMotion = useReducedMotion();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.row}>
      {DELAYS.map(delay => (
        <Animated.View
          key={delay}
          style={[
            styles.dot,
            { backgroundColor: t.textSecondary },
            reduceMotion ? styles.dotStill : wave,
            { animationDelay: delay },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 25,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  // Reduce Motion stand-in: a fixed mid-opacity, no wave.
  dotStill: {
    opacity: 0.55,
  },
});
