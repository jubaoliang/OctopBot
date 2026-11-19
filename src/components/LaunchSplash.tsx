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

  // The same alpha lands very differently on paper and on near-black, so each
  // theme carries its own ramp instead of one scaled by a factor. The dark one
  // keeps a paler core so the orange does not read as paint; the light one is
  // the warm colour straight through, the way it looks on a sheet of paper.
  const glowStops = [
    ...(resolvedMode === 'dark'
      ? [
          { offset: 0, color: t.splashGlowCore, opacity: 0.24 },
          { offset: 0.45, color: t.splashGlow, opacity: 0.12 },
          { offset: 0.75, color: t.splashGlow, opacity: 0.055 },
          { offset: 0.9, color: t.splashGlow, opacity: 0.028 },
        ]
      : [
          { offset: 0, color: t.splashGlow, opacity: 0.6 },
          { offset: 0.45, color: t.splashGlow, opacity: 0.29 },
          { offset: 0.75, color: t.splashGlow, opacity: 0.17 },
          { offset: 0.9, color: t.splashGlow, opacity: 0.11 },
        ]),
    { offset: 1, color: t.splashGlow, opacity: 0 },
  ];

  // The source sits above the top edge so only its lower fringe reaches the
  // screen, which is what makes it read as light rather than a painted wash.
  // Wide and shallow-graded on purpose: it has to reach the full width of the
  // top edge and fall away only around a third of the way down.
  const light = {
    cx: width * 0.3,
    cy: -height * 0.08,
    rx: width * 0.85,
    ry: height * 0.42,
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
              leaves a seam you can see on a near-black background. The ramp
              is long and shallow so the fall-off stays soft across the whole
              third of the screen it covers. */}
          <RadialGradient id="splashLight" cx="50%" cy="50%" r="50%">
            {glowStops.map(stop => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
                stopOpacity={stop.opacity}
              />
            ))}
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
