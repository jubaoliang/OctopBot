import { Platform } from 'react-native';

/**
 * The platform's push, named for the native stack. iOS `default` is the real
 * UIKit push (parallax + interactive pop); Android's `default` is a crossfade,
 * so the shared HIG push idiom is requested there explicitly — a directional
 * slide whose reverse plays on system back (this navigator has no interactive
 * swipe-back on Android; `animationMatchesGesture` in `useStackAnimation`
 * covers the iOS swipe). Lives here so no layout asks which OS it is on.
 */
export const STACK_PUSH_ANIMATION: 'default' | 'slide_from_right' =
  Platform.OS === 'android' ? 'slide_from_right' : 'default';

/**
 * Whether the native stack emits transitionStart/transitionEnd here.
 * Whitelisted like the other capability flags: an unverified runtime (e.g.
 * the planned HarmonyOS port) must not pay the gate's timeout on every
 * open — a false negative only loses the deferred-fetch optimisation.
 * Lives here so feature code never asks which OS it is on.
 */
export const HAS_STACK_TRANSITION_EVENTS = Platform.OS === 'ios' || Platform.OS === 'android';
