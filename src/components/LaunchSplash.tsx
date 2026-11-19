import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * The launch plate is the very artwork the native splash draws — the same
 * lockup, the same orange light falling from the top edge — so the handoff from
 * the OS splash to this screen is invisible. The ink is baked into the drawing
 * (dark on the light theme, white on the dark one), so the theme picks the
 * asset rather than tinting it.
 */
const PLATE = {
  light: require('@/assets/images/splash-full.png'),
  dark: require('@/assets/images/splash-full-dark.png'),
};

/**
 * Launch screen: the brand plate and a spinner while the app boots.
 *
 * It stands in between the native splash and the first screen — fonts and the
 * stored session are being read — and holds to a single idea: one logo, one
 * spinner. Matching the native artwork matters more than adding to it; anything
 * new here would read as a flash between the two.
 */
export function LaunchSplash() {
  const { tokens: t, resolvedMode } = useTheme();

  return (
    <View
      testID="launch-splash"
      style={[styles.root, { backgroundColor: t.bg }]}
      accessibilityRole="progressbar"
    >
      <Image
        source={PLATE[resolvedMode]}
        style={styles.plate}
        resizeMode="cover"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.spinnerSlot}>
        <ActivityIndicator color={t.brand} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  plate: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  spinnerSlot: {
    // Just under the wordmark, in the empty lower half of the plate.
    position: 'absolute',
    top: '59%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
