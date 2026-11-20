import { useReducedMotion } from 'react-native-reanimated';

import { useTokens } from './ThemeProvider';

// The native-stack options type is not re-exported through expo-router's
// public entry (its exports map blocks deep imports), so the three keys are
// declared locally; a screens-side rename would surface as a runtime no-op,
// caught by the screens this helper feeds.
type StackAnimationOptions = {
  animation: 'default' | 'fade';
  customAnimationOnGesture: boolean;
  contentStyle: { backgroundColor: string };
};

/**
 * Shared stack transition options: Reduce Motion swaps the platform push
 * for a fade (HIG: fewer and gentler). `customAnimationOnGesture` keeps the
 * iOS interactive back swipe working under the fade — native-stack drops
 * the gesture for custom animations unless this is set. `contentStyle`
 * carries the shared opaque background so every stack paints the same one.
 * One helper so all stack layouts emit the same choice and cannot drift.
 */
export function useStackAnimation(): StackAnimationOptions {
  const reduceMotion = useReducedMotion();
  const { bg } = useTokens();
  return {
    animation: reduceMotion ? 'fade' : 'default',
    customAnimationOnGesture: reduceMotion,
    contentStyle: { backgroundColor: bg },
  };
}
