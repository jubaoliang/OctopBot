import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/platform/haptics';
import { continuousCorners, motion, radius, typeScale, useTokens } from '@/theme';

/** iOS sheet curve — the same easing the drawer and the chrome use. */
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/** Drag distance (pt) past which a release dismisses instead of settling back. */
const DISMISS_DISTANCE = 96;
/** Flick speed (pt/s) that dismisses regardless of distance. */
const DISMISS_VELOCITY = 700;

interface BottomSheetProps {
  visible: boolean;
  /** Asked to close by the scrim, a swipe, the hardware back button or Done. */
  onClose: () => void;
  /** Fired once the sheet has finished sliding off screen. */
  onDismissed?: () => void;
  /** Screen-reader label for the dismiss layer. */
  dismissLabel: string;
  /** Sheet heading, centered above the content like a system sheet. */
  title?: string;
  subtitle?: string;
  /** Trailing header control, e.g. Done. */
  headerAction?: ReactNode;
  /** Show the grabber. Off for sheets that cannot be resized. */
  grabber?: boolean;
  /**
   * Put the content in the sheet's own scroll view. The viewport is set to the
   * content height when it fits and capped at the space left over when it does
   * not — that is what makes the list scroll instead of drawing past the sheet.
   */
  scroll?: boolean;
  /**
   * Sheet content. Pass a function to receive the height left over after the
   * header and the bottom inset — a scrolling child needs it as `maxHeight`,
   * because a `maxHeight`-capped sheet does not shrink its children.
   */
  children: ReactNode | ((layout: { maxHeight: number }) => ReactNode);
  testID?: string;
}

/**
 * Bottom sheet — the app's one modal surface for choices and short tasks.
 *
 * Apple's sheet anatomy: it rises from the bottom edge over a dimmed scrim,
 * carries a grabber when it can be dragged, dismisses on a swipe down, on a
 * scrim tap and on the hardware back button. Reduce Motion collapses the
 * slide and the fade to an instant change.
 *
 * The sheet unmounts only after its exit animation, so the scrim leaves with
 * it instead of vanishing on the frame the parent flips `visible`. Only the
 * header takes the drag, so a scrollable list inside keeps its own scroll.
 */
export function BottomSheet({
  visible,
  onClose,
  onDismissed,
  dismissLabel,
  title,
  subtitle,
  headerAction,
  grabber = true,
  scroll = false,
  children,
  testID,
}: BottomSheetProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  // Measured header height, so the body can be capped exactly.
  const [headerHeight, setHeaderHeight] = useState(0);
  // Measured content height for `scroll`, so the viewport can be sized to it.
  const [contentHeight, setContentHeight] = useState(0);
  // Distance the sheet is pushed below its resting place. 0 = fully open.
  const translate = useSharedValue(windowHeight);
  const dragStart = useSharedValue(0);
  // 1 once a close has been committed, so a settling gesture cannot be
  // reopened by a late effect run.
  const closing = useSharedValue(0);
  const gestureClosing = useRef(false);

  const duration = reduceMotion ? 0 : motion.sheet;

  const finishDismiss = useCallback(() => {
    setMounted(false);
    onDismissed?.();
  }, [onDismissed]);

  useEffect(() => {
    if (visible) {
      closing.set(0);
      gestureClosing.current = false;
      if (mounted) {
        translate.set(withTiming(0, { duration, easing: EASE_SHEET }));
        return;
      }
      // First open: start off screen, mount, then animate in on the next
      // frame so the open position is never painted first.
      translate.set(windowHeight);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-on-open is the sheet's own lifecycle
      setMounted(true);
      requestAnimationFrame(() => {
        translate.set(withTiming(0, { duration, easing: EASE_SHEET }));
      });
      return;
    }
    if (!mounted || gestureClosing.current) {
      return;
    }
    closing.set(1);
    translate.set(
      withTiming(windowHeight, { duration: reduceMotion ? 0 : 220, easing: EASE_SHEET }, done => {
        if (done) {
          scheduleOnRN(finishDismiss);
        }
      }),
    );
  }, [visible, mounted, duration, reduceMotion, windowHeight, translate, closing, finishDismiss]);

  const closeFromGesture = useCallback(() => {
    gestureClosing.current = true;
    haptics.impact('light');
    onClose();
  }, [onClose]);

  const pan = usePanGesture({
    // Vertical drags move the sheet; horizontal ones belong to the content.
    // The pair is [lower bound, upper bound] — it must straddle zero, or the
    // gesture handler throws on mount.
    activeOffsetY: [-8, 8],
    failOffsetX: [-12, 12],
    onActivate: () => {
      'worklet';
      if (closing.get() === 1) {
        return;
      }
      dragStart.set(translate.get());
    },
    onUpdate: event => {
      'worklet';
      if (closing.get() === 1) {
        return;
      }
      // Downward only: the sheet has no detents to expand into.
      translate.set(Math.max(0, dragStart.get() + event.translationY));
    },
    onDeactivate: event => {
      'worklet';
      if (closing.get() === 1) {
        return;
      }
      const released = Math.max(0, dragStart.get() + event.translationY);
      if (released > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        closing.set(1);
        // The sheet finishes its own exit here: the parent flips `visible`
        // in the same beat and must not start a second animation.
        translate.set(
          withTiming(windowHeight, { duration, easing: EASE_SHEET }, done => {
            if (done) {
              scheduleOnRN(finishDismiss);
            }
          }),
        );
        scheduleOnRN(closeFromGesture);
        return;
      }
      // A short drag settles back instead of closing.
      translate.set(withTiming(0, { duration: motion.state, easing: EASE_SHEET }));
    },
  });

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, 1 - translate.get() / Math.max(1, windowHeight * 0.4))),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translate.get() }],
  }));

  if (!mounted) {
    return null;
  }

  const bottomInset = Math.max(insets.bottom, 12) + 8;
  const sheetMaxHeight = windowHeight * 0.9;
  // Until the header is measured, reserve the grabber plus a title line.
  const measuredHeader = headerHeight > 0 ? headerHeight : 60;
  const bodyMaxHeight = Math.max(160, sheetMaxHeight - measuredHeader - bottomInset);
  const content =
    typeof children === 'function' ? children({ maxHeight: bodyMaxHeight }) : children;
  const body = scroll ? (
    <ScrollView
      style={{ height: contentHeight > 0 ? Math.min(contentHeight, bodyMaxHeight) : undefined }}
      onContentSizeChange={(_width, height) => setContentHeight(height)}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      bounces={false}
    >
      {content}
    </ScrollView>
  ) : (
    content
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      // Hardware back reaches the sheet, not the screen behind it.
      onRequestClose={onClose}
    >
      {/* A Modal is its own native root on Android; the drag needs a root
          view inside it, not the one behind the modal. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]}
            onPress={onClose}
            testID={testID ? `${testID}-scrim` : undefined}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          testID={testID}
          style={[
            styles.sheet,
            continuousCorners,
            sheetStyle,
            {
              backgroundColor: t.bg,
              borderColor: t.borderSubtle,
              paddingBottom: bottomInset,
              maxHeight: sheetMaxHeight,
            },
          ]}
        >
          <GestureDetector gesture={pan}>
            <View
              style={styles.headerBlock}
              onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
            >
              <View style={styles.grabberZone}>
                {grabber ? (
                  <View style={[styles.grabber, { backgroundColor: t.textPlaceholder }]} />
                ) : null}
              </View>
              {title ? (
                <View style={styles.header}>
                  <View style={styles.headerText}>
                    <Text
                      accessibilityRole="header"
                      style={[styles.title, { color: t.textPrimary }]}
                      numberOfLines={2}
                    >
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text style={[styles.subtitle, { color: t.textSecondary }]} numberOfLines={2}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {headerAction}
                </View>
              ) : null}
            </View>
          </GestureDetector>
          {body}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headerBlock: {
    // Drag handle: the only part of the sheet that pans, so content keeps
    // its own scrolling.
    paddingBottom: 4,
  },
  grabberZone: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typeScale.headline,
  },
  subtitle: {
    ...typeScale.footnote,
  },
});
