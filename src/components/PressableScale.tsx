import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { layout, motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Cards and pills: 0.97; small glyph buttons: 0.9. */
  scaleTo?: number;
  /** Opacity while pressed. Glyph buttons dim; surfaces usually do not. */
  dimTo?: number;
}

/**
 * The app's one press-feedback primitive: feedback on press-in, commit on
 * press-out, a 3% scale over 120ms on the UI thread (Reanimated CSS
 * transition). With Reduce Motion on, the scale is replaced by a dim so the
 * press still reads.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  dimTo,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useReducedMotion();

  const pressedStyle: ViewStyle = reduceMotion
    ? { opacity: dimTo ?? 0.6 }
    : { transform: [{ scale: scaleTo }], opacity: dimTo ?? 1 };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      // A finger drifting a few points must not cancel an intended press.
      pressRetentionOffset={layout.hitTarget / 2}
      onPressIn={(event: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[styles.base, pressTransition, style, pressed && !disabled ? pressedStyle : null]}
    >
      {children}
    </AnimatedPressable>
  );
}

// Reanimated CSS transition (UI thread). Kept out of StyleSheet.create,
// whose core types do not know Reanimated's easing objects.
const pressTransition = {
  transitionProperty: ['transform', 'opacity'],
  transitionDuration: motion.press,
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const;

const styles = StyleSheet.create({
  base: {
    transform: [{ scale: 1 }],
    opacity: 1,
  },
});
