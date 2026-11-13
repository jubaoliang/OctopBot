import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Text } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/theme';

/** Strong ease-out — HIG brevity: the eye sees the settle, not the wind-up. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Frames of progress sampled during the count-up. Caps RN bridge traffic so
 * a multi-million total does not schedule a setState per integer.
 */
const SAMPLE_FRAMES = 48;

interface AnimatedCountProps extends Omit<ComponentProps<typeof Text>, 'children'> {
  /** Numeric value to count toward. */
  value: number;
  /** Format the live integer for display (compact, grouping, …). */
  format: (value: number) => string;
}

/**
 * Soft count-up for rare headline figures (Token 统计 total). Follows Apple
 * HIG Motion: purposeful, brief, interruptible; Reduce Motion snaps to the
 * final value (no spinning digit wheels — those are a motion trigger).
 */
export function AnimatedCount({ value, format, ...textProps }: AnimatedCountProps) {
  const reduceMotion = useReducedMotion();
  const safeValue = Number.isFinite(value) ? value : 0;
  const [shown, setShown] = useState(() => format(safeValue));
  // First paint counts up from 0; later updates count from the previous total.
  const hasPlayed = useRef(false);
  // Keep format fresh without putting a deps array on useAnimatedReaction —
  // Reanimated ignores those on native and warns (web-only).
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  const progress = useSharedValue(1);
  const fromValue = useSharedValue(0);
  const toValue = useSharedValue(safeValue);

  const paint = useCallback((next: number) => {
    setShown(formatRef.current(next));
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      fromValue.set(safeValue);
      toValue.set(safeValue);
      progress.set(1);
      hasPlayed.current = true;
      return;
    }

    fromValue.set(hasPlayed.current ? toValue.get() : 0);
    toValue.set(safeValue);
    hasPlayed.current = true;
    progress.set(0);
    progress.set(
      withTiming(1, {
        duration: motion.sheet,
        easing: EASE_OUT,
      }),
    );
  }, [safeValue, reduceMotion, progress, fromValue, toValue]);

  useAnimatedReaction(
    () => Math.round(progress.get() * SAMPLE_FRAMES),
    (frame, previous) => {
      'worklet';
      if (frame === previous) {
        return;
      }
      const t = frame / SAMPLE_FRAMES;
      const next = Math.round(fromValue.get() + (toValue.get() - fromValue.get()) * t);
      scheduleOnRN(paint, next);
    },
  );

  // Reduce Motion: show the final figure immediately (HIG — no roll / spin).
  const label = reduceMotion ? format(safeValue) : shown;

  return <Text {...textProps}>{label}</Text>;
}
