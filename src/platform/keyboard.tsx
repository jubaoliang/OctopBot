import { useEffect, type ReactNode } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {
  AndroidSoftInputModes,
  KeyboardAwareScrollView,
  KeyboardController,
  KeyboardProvider as RNKeyboardProvider,
  useKeyboardHandler,
  useKeyboardState,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';

import { keyboardInset } from '@/utils/keyboard-inset';

/**
 * Keyboard capability wrapper — the ONLY place react-native-keyboard-controller
 * is imported (AGENTS.md wrapper hygiene; HarmonyOS can swap this module for
 * an implementation built on RN's Keyboard events when that port lands).
 *
 * Expo apps are edge-to-edge on Android, so the system window no longer
 * resizes for the IME. This library reports the keyboard frame on both
 * platforms and avoidance is driven from it.
 *
 * On Android we force `adjustNothing`: with edge-to-edge + `adjustResize` the
 * IME inset is often reported as 0, so nothing would ever move.
 */
export function KeyboardProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
    return () => {
      KeyboardController.setDefaultMode();
    };
  }, []);

  return (
    <RNKeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
      {children}
    </RNKeyboardProvider>
  );
}

/**
 * The height the keyboard covers right now, in points, updated on the UI
 * thread every frame of its animation on both platforms.
 *
 * This is the measured frame, not "is it shown": a floating keyboard, a
 * hardware-keyboard accessory or a stylus toolbar is shown but covers
 * nothing, and reports 0 here.
 */
export function useKeyboardHeight(): SharedValue<number> {
  const { height: contextHeight } = useReanimatedKeyboardAnimation();
  const height = useSharedValue(0);

  // A screen can mount while the keyboard is already up (pushed from a
  // focused composer); the handler below only reports later changes.
  useEffect(() => {
    height.set(Math.max(0, -contextHeight.get()));
  }, [contextHeight, height]);

  useKeyboardHandler(
    {
      // No onStart: it carries the destination height, not the current one.
      onMove: event => {
        'worklet';
        height.set(event.height);
      },
      onInteractive: event => {
        'worklet';
        height.set(event.height);
      },
      onEnd: event => {
        'worklet';
        height.set(event.height);
      },
    },
    [],
  );

  return height;
}

interface KeyboardInsetViewProps {
  /**
   * Bottom inset while the keyboard covers less than this — the room a
   * screen keeps for chrome under its content, e.g. the floating tab bar.
   */
  restingInset?: number;
  /** Space between the keyboard's top edge and the content above it. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Keeps its content above the keyboard. The view must end at the bottom
 * edge of the window (no bottom safe-area padding around it); its bottom
 * padding is whichever is taller — the resting inset or the keyboard plus
 * the gap. The content therefore stays put until the keyboard actually
 * reaches it and never jumps when the keyboard opens, closes, resizes or
 * turns into a floating one.
 */
export function KeyboardInsetView({
  restingInset = 0,
  gap = 0,
  style,
  children,
}: KeyboardInsetViewProps) {
  const keyboardHeight = useKeyboardHeight();

  const insetStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardInset(keyboardHeight.get(), restingInset, gap),
  }));

  return <Animated.View style={[style, insetStyle]}>{children}</Animated.View>;
}

export { KeyboardAwareScrollView, useKeyboardState };
