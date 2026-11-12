import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

import { haptics } from '@/platform/haptics';
import { continuousCorners, layout, motion, typeScale, useTokens } from '@/theme';

interface SegmentedControlProps<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** Describes the group to assistive tech (e.g. "Appearance"). */
  accessibilityLabel?: string;
}

const TRACK_PADDING = 2;
const SEGMENT_HEIGHT = 32;

// Reanimated CSS transition; on-screen movement, not an entrance, so the
// curve is ease-in-out. Not in StyleSheet.create (core style types do not
// know Reanimated's easing objects).
const thumbTransition = {
  transitionProperty: 'transform',
  transitionDuration: motion.state,
  transitionTimingFunction: cubicBezier(0.77, 0, 0.175, 1),
} as const;
const VERTICAL_SLOP = (layout.hitTarget - SEGMENT_HEIGHT) / 2;

/**
 * Segmented control in the iOS anatomy: a tinted track with a raised thumb
 * that slides to the selection. The thumb is absolutely positioned and
 * childless, so only its transform animates (UI-thread CSS transition).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const t = useTokens();
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(
    0,
    options.findIndex(o => o.id === value),
  );
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: t.overlaySubtle }]}
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            thumbTransition,
            {
              width: segmentWidth,
              backgroundColor: t.surfaceRaised,
              shadowColor: t.shadow,
              transform: [{ translateX: index * segmentWidth }],
            },
          ]}
        />
      ) : null}
      {options.map(option => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            // The 32pt segment reaches the 44pt target through hitSlop.
            hitSlop={{ top: VERTICAL_SLOP, bottom: VERTICAL_SLOP }}
            style={styles.segment}
            onPress={() => {
              if (!active) {
                haptics.selection();
                onChange(option.id);
              }
            }}
          >
            <Text
              style={[
                styles.label,
                { color: active ? t.textPrimary : t.textSecondary },
                active ? styles.labelActive : null,
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 9,
    ...continuousCorners,
    padding: TRACK_PADDING,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    height: SEGMENT_HEIGHT,
    borderRadius: 7,
    ...continuousCorners,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  label: {
    ...typeScale.subheadline,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '600',
  },
});
