import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';
import { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { STACK_PUSH_ANIMATION } from '@/platform/stack-transition';

import { motion } from './tokens';

// Derived from the navigator's own option type so a screens-side rename
// (like customAnimationOnGesture → animationMatchesGesture) is a compile
// error here, not a silent runtime no-op.
type StackScreenOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack>['screenOptions']>,
  (...args: never[]) => unknown
>;
type StackAnimationOptions = Pick<StackScreenOptions, 'animation' | 'animationMatchesGesture'>;

/**
 * Shared stack transition options: the platform push (see
 * `platform/stack-transition` — Android gets the directional slide its
 * `default` lacks), swapped for a fade under Reduce Motion (HIG: fewer and
 * gentler). `animationMatchesGesture` makes the iOS back swipe run whichever
 * animation is set in reverse, so dragging back never looks like a different
 * app than pushing forward — it is also what keeps the swipe alive under the
 * Reduce Motion fade. Backgrounds are owned by each layout's `contentStyle`
 * (opaque at the root, transparent inside the tab stacks). One helper so all
 * stack layouts emit the same choice and cannot drift.
 */
export function useStackAnimation(): StackAnimationOptions {
  const reduceMotion = useReducedMotion();
  return {
    animation: reduceMotion ? 'fade' : STACK_PUSH_ANIMATION,
    animationMatchesGesture: true,
  };
}

/**
 * The top-level branch swap (splash → login/app, login ↔ app): one fade
 * pair shared by the root layout and the splash so the two halves of the
 * handover cannot drift apart. Reduce Motion gets an instant swap.
 */
export function useBranchFade() {
  const reduceMotion = useReducedMotion();
  return {
    entering: reduceMotion ? undefined : FadeIn.duration(motion.sheet),
    exiting: reduceMotion ? undefined : FadeOut.duration(motion.state),
  };
}
