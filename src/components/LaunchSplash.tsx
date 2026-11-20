import { ActivityIndicator, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

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

type Band = {
  key: string;
  /** How far down the light reaches, as a share of the height. */
  depth: number;
  /** Degrees of lean; negative lifts the right side, so the light pools left. */
  tilt: number;
  /** Opacity where the band is brightest. */
  peak: number;
};

/**
 * Straight-edged layers rather than one radial field. A radial gradient whose
 * centre sits just above the screen paints its iso-lines as arcs, and one arc
 * under another reads as a sun behind the top edge — even brightness, clean
 * round rim. Light from a large distant source is closer to a straight
 * fall-off, so each layer here is a full-width band with a straight edge, and
 * the three lean at different angles and reach different depths. Where they
 * cross, the band is thicker on one side than the other and its lower boundary
 * becomes a broken line instead of a dome.
 *
 * Every band runs past both sides of the screen and fades to nothing at its
 * own edges, so none of them shows a seam.
 */
const BANDS: Band[] = [
  { key: 'a', depth: 0.34, tilt: -13, peak: 0.22 },
  { key: 'b', depth: 0.26, tilt: 7, peak: 0.14 },
  { key: 'c', depth: 0.3, tilt: -3, peak: 0.12 },
];

/** Where each band starts fading in, as a share of the height. */
const BAND_TOP = -0.16;

type Patch = {
  key: string;
  /** Centre and radii, as shares of the viewport. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  tilt: number;
  peak: number;
};

/**
 * What stops the bands from reading as a plain gradient: flat, soft patches set
 * at uneven points along the edge. Each only thickens the light where it sits,
 * so the boundary steps in and out instead of following one line, and the top
 * edge is no longer equally bright all the way across.
 */
const PATCHES: Patch[] = [
  { key: 'a', cx: 0.16, cy: -0.01, rx: 0.34, ry: 0.2, tilt: -14, peak: 0.36 },
  { key: 'b', cx: 0.44, cy: -0.08, rx: 0.2, ry: 0.12, tilt: 4, peak: 0.2 },
  { key: 'c', cx: 0.8, cy: 0.02, rx: 0.3, ry: 0.18, tilt: 12, peak: 0.32 },
  { key: 'd', cx: 0.62, cy: -0.05, rx: 0.22, ry: 0.13, tilt: -8, peak: 0.16 },
];

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

  // The same alpha lands very differently on paper and on near-black, so the
  // dark theme runs the whole thing at a fraction of the light one's, and keeps
  // the paler core at the hot end so the orange does not read as paint.
  const dark = resolvedMode === 'dark';
  const lift = dark ? 0.5 : 1;
  const patchColor = dark ? t.splashGlowCore : t.splashGlow;
  const top = height * BAND_TOP;

  const bands = BANDS.map(band => {
    const bottom = height * band.depth;
    const span = bottom - top;
    // Hot just above the visible edge, then a fall-off that thins out rather
    // than dimming on a curve — the eye reads a straight fade as distance.
    const profile = [
      { y: top, k: 0 },
      { y: -height * 0.08, k: 0.8 },
      { y: -height * 0.02, k: 1 },
      { y: bottom * 0.35, k: 0.45 },
      { y: bottom * 0.7, k: 0.15 },
      { y: bottom, k: 0 },
    ];
    return {
      ...band,
      top,
      bottom,
      stops: profile.map(({ y, k }) => ({
        offset: (y - top) / span,
        color: dark && k > 0.6 ? t.splashGlowCore : t.splashGlow,
        opacity: k * band.peak * lift,
      })),
    };
  });
  const entering = reduceMotion ? undefined : FadeIn.duration(motion.sheet);

  return (
    <View
      testID="launch-splash"
      style={[styles.root, { backgroundColor: t.bg }]}
      accessibilityRole="progressbar"
    >
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          {bands.map(band => (
            <LinearGradient
              key={band.key}
              id={`splash-${band.key}`}
              x1="0"
              y1={band.top}
              x2="0"
              y2={band.bottom}
              gradientUnits="userSpaceOnUse"
            >
              {band.stops.map(stop => (
                <Stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor={stop.color}
                  stopOpacity={stop.opacity}
                />
              ))}
            </LinearGradient>
          ))}
        </Defs>

        <Defs>
          <RadialGradient id="splash-patch" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={patchColor} stopOpacity={1} />
            <Stop offset="0.45" stopColor={patchColor} stopOpacity={0.55} />
            <Stop offset="0.75" stopColor={t.splashGlow} stopOpacity={0.18} />
            <Stop offset="1" stopColor={t.splashGlow} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {bands.map(band => (
          <Rect
            key={band.key}
            x={-width * 0.4}
            y={band.top}
            width={width * 1.8}
            height={band.bottom - band.top}
            fill={`url(#splash-${band.key})`}
            transform={`rotate(${band.tilt} ${width / 2} ${(band.top + band.bottom) / 2})`}
          />
        ))}

        {PATCHES.map(patch => (
          <Ellipse
            key={patch.key}
            cx={width * patch.cx}
            cy={height * patch.cy}
            rx={width * patch.rx}
            ry={height * patch.ry}
            opacity={patch.peak * lift}
            fill="url(#splash-patch)"
            transform={`rotate(${patch.tilt} ${width * patch.cx} ${height * patch.cy})`}
          />
        ))}
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
