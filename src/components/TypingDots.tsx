import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

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
 * first streamed token. Opacity only — it stays gentle under Reduce Motion.
 */
export function TypingDots({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.row}>
      {DELAYS.map(delay => (
        <Animated.View
          key={delay}
          style={[
            styles.dot,
            { backgroundColor: t.textSecondary },
            wave,
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
});
