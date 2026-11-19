import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

/**
 * The brand plate is a 1:1 square: the red mark sits at the top, the wordmark
 * runs the full width underneath, with matching breathing room above and below.
 * Rendering it at its natural ratio keeps the two halves in the proportion the
 * artwork was drawn in — cropping or restacking them breaks the lockup.
 */
const LOGO = 128;

/**
 * The ink is baked into the artwork — dark for the light theme, white for the
 * dark one — so the plate is chosen by theme instead of tinted at runtime. The
 * mark's glow uses `feGaussianBlur`, which `react-native-svg` cannot draw, so
 * the vector lockup ships rasterized rather than as an SVG component.
 */
const PLATE = {
  light: require('@/assets/images/launch-logo-light.png'),
  dark: require('@/assets/images/launch-logo-dark.png'),
};

/**
 * Launch screen: the vertical lockup and a spinner while the app boots.
 *
 * It is what the app shows between the native splash and the first screen —
 * fonts and the stored session are being read — so it stays to a single idea:
 * one logo, one spinner. The ink is baked into the artwork (dark on the light
 * background, white on the dark one), so the theme picks the asset rather than
 * tinting it.
 */
export function LaunchSplash() {
  const { tokens: t, resolvedMode } = useTheme();
  const reduceMotion = useReducedMotion();

  return (
    <View
      testID="launch-splash"
      style={[styles.root, { backgroundColor: t.bg }]}
      accessibilityRole="progressbar"
    >
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(360)}>
        <Image
          source={PLATE[resolvedMode]}
          style={styles.logo}
          resizeMode="contain"
          fadeDuration={0}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      <ActivityIndicator style={styles.spinner} color={t.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // The spinner hangs under the plate; the block itself is optically centred,
    // a touch above the geometric middle.
    paddingBottom: 24,
  },
  logo: {
    width: LOGO,
    height: LOGO,
  },
  spinner: {
    // The plate carries its own margin under the wordmark, so this only adds
    // the gap that reads as part of the lockup.
    marginTop: 12,
  },
});
