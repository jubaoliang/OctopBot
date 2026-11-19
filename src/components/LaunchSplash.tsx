import { ActivityIndicator, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { motion, useTheme } from '@/theme';

const MASCOT = require('@/assets/images/splash-mascot.png');
const WORDMARK = {
  light: require('@/assets/images/octop-wordmark.png'),
  dark: require('@/assets/images/octop-wordmark-dark.png'),
};

/** The wordmark asset is 1890x659. */
const WORDMARK_RATIO = 659 / 1890;

/** Shares of the viewport. */
const MASCOT_WIDTH = 0.42;
const WORDMARK_WIDTH = 0.36;
/** The lockup sits just above the middle, leaving the lower half open. */
const CENTRE = 0.425;
const SPINNER_GAP = 26;

/**
 * Launch screen: the mascot and the wordmark on the theme background, with a
 * little warm light spilling in over the top edge, plus a spinner.
 *
 * Everything is drawn here instead of being painted into a splash plate, so
 * the screen follows the theme without a per-theme asset, stays crisp at any
 * density, and can fade up when the native splash — which is now only the
 * background colour — hands over.
 */
export function LaunchSplash() {
  const { tokens: t, resolvedMode } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // The mascot is a square tile with its own padding, so the tile's centre is
  // the character's centre. Cap it against the height too, for tablets.
  const mascot = Math.min(width * MASCOT_WIDTH, height * 0.3);
  const wordmark = Math.min(width * WORDMARK_WIDTH, mascot * 0.95);
  const wordmarkHeight = wordmark * WORDMARK_RATIO;
  const lockupTop = height * CENTRE - (mascot + wordmarkHeight) / 2;

  // A trace of light on the light theme; the dark one can carry more.
  const k = resolvedMode === 'dark' ? 1 : 0.55;

  // The source sits above the top edge so only its lower fringe reaches the
  // screen, which is what makes it read as light rather than a painted wash.
  const light = {
    cx: width * 0.4,
    cy: -height * 0.045,
    rx: width * 0.6,
    ry: height * 0.125,
  };
  const entering = reduceMotion ? undefined : FadeIn.duration(motion.sheet);

  return (
    <View
      testID="launch-splash"
      style={[styles.root, { backgroundColor: t.bg }]}
      accessibilityRole="progressbar"
    >
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          {/* Hot at the point where it meets the edge, cooling as it falls
              away. One field rather than stacked lobes: overlapping them
              leaves a seam you can see on a near-black background. */}
          <RadialGradient id="splashLight" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={t.splashGlowCore} stopOpacity={0.3 * k} />
            <Stop offset="0.42" stopColor={t.splashGlow} stopOpacity={0.13 * k} />
            <Stop offset="0.78" stopColor={t.splashGlow} stopOpacity={0.035 * k} />
            <Stop offset="1" stopColor={t.splashGlow} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* leaning in from the upper left, so the light has a direction */}
        <Ellipse
          cx={light.cx}
          cy={light.cy}
          rx={light.rx}
          ry={light.ry}
          fill="url(#splashLight)"
          transform={`rotate(-14 ${light.cx} ${light.cy})`}
        />
      </Svg>

      <Animated.View
        entering={entering}
        pointerEvents="none"
        style={[styles.lockup, { top: lockupTop }]}
      >
        <Image
          source={MASCOT}
          style={{ width: mascot, height: mascot }}
          resizeMode="contain"
          fadeDuration={0}
          accessibilityIgnoresInvertColors
        />
        <Image
          source={WORDMARK[resolvedMode]}
          style={{ width: wordmark, height: wordmarkHeight }}
          resizeMode="contain"
          fadeDuration={0}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      <Animated.View
        entering={entering}
        style={[styles.spinnerSlot, { top: lockupTop + mascot + wordmarkHeight + SPINNER_GAP }]}
      >
        <ActivityIndicator size="small" color={t.brand} style={styles.spinner} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lockup: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  spinnerSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Android's indeterminate ProgressBar collapses to a dot when it has to
  // measure itself, so give it a box to fill.
  spinner: {
    width: 20,
    height: 20,
  },
});
