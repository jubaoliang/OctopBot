import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { continuousCorners, useTokens } from '@/theme';

/** Pacifico, the script face of the wordmark (loaded in the root layout). */
export const BRAND_FONT = 'Pacifico_400Regular';

const RING = 72;
const RING_WIDTH = 9;

/**
 * Launch screen: the mark, the wordmark and a spinner while the app boots.
 *
 * It is what the app shows between the native splash and the first screen —
 * fonts and the stored session are being read — so it stays to a single
 * idea: one red ring, "octop", one spinner. The ring breathes while it waits;
 * Reduce Motion turns that off and leaves the still frame.
 */
export function LaunchSplash() {
  const t = useTokens();
  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      breathe.set(1);
      return;
    }
    breathe.set(
      withRepeat(
        withSequence(
          withTiming(1.07, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [breathe, reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.get() }] }));

  return (
    <View
      testID="launch-splash"
      style={[styles.root, { backgroundColor: t.bg }]}
      accessibilityRole="progressbar"
    >
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(320)}>
        <Animated.View
          style={[styles.ring, { borderColor: t.brand }, reduceMotion ? null : ringStyle]}
        />
      </Animated.View>
      <Text style={[styles.wordmark, { color: t.textPrimary }]} maxFontSizeMultiplier={1.2}>
        octop
      </Text>
      <ActivityIndicator style={styles.spinner} color={t.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // The spinner sits a fixed distance under the wordmark; the block itself
    // is optically centred, a touch above the geometric middle.
    paddingBottom: 24,
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: RING_WIDTH,
    ...continuousCorners,
  },
  wordmark: {
    marginTop: 18,
    fontFamily: BRAND_FONT,
    fontSize: 40,
    lineHeight: 52,
    // Pacifico sits high in its box; the line height keeps the optical gap
    // to the ring even without a descender.
    includeFontPadding: false,
  },
  spinner: {
    marginTop: 22,
  },
});
