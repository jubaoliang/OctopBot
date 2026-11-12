import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Line, Path, Svg } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/platform/haptics';
import { motion, typeScale, useTokens } from '@/theme';
import {
  axisLabelIndices,
  barIndexAt,
  barPath,
  growBar,
  layoutBars,
  type BarRect,
} from '@/utils/bar-chart';

interface BarChartProps {
  values: readonly number[];
  /** One label per bar; only as many as fit are drawn under the plot. */
  axisLabels: readonly string[];
  /** Text for a value-axis tick. */
  formatTick: (value: number) => string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** What the chart shows, for VoiceOver / TalkBack (type, range, key figures). */
  accessibilityLabel: string;
  /** Spoken description of one bar: its day and exact value. */
  describeBar: (index: number) => string;
  height?: number;
  testID?: string;
}

/** Room for value labels on the trailing side, so the leading edge stays clean. */
const TICK_COLUMN = 42;
const AXIS_ROW = 18;
const TOP_INSET = 8;
/** Line height of a tick label; half of it centers the label on its grid line. */
const TICK_LINE = 13;
const AXIS_LABEL_WIDTH = 44;
const BAR_RADIUS = 3;

/** Strong ease-out — matches AnimatedCount / HIG brevity. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Bar chart drawn with react-native-svg from the pure geometry in
 * `utils/bar-chart` — no chart library, so it runs wherever SVG does.
 *
 * Follows the HIG charts guidance: value labels sit on the trailing side so
 * the plot aligns with the cards around it; the whole plot is the touch
 * target (tap a bar, or drag across to scrub); and assistive tech gets a
 * summary plus one spoken value per bar through the adjustable actions,
 * instead of the visual axis labels.
 *
 * On first paint and when the series changes, bars grow from the baseline
 * (Swift Charts–style mark update). Scrubbing never restarts that motion.
 * Reduce Motion snaps bars to their final height.
 */
export function BarChart({
  values,
  axisLabels,
  formatTick,
  selectedIndex,
  onSelect,
  accessibilityLabel,
  describeBar,
  height = 168,
  testID,
}: BarChartProps) {
  const t = useTokens();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const count = values.length;
  const seriesKey = useMemo(() => values.join(','), [values]);

  // The scrub worklet reads the plot size from shared values, so it never
  // works from a stale closure after a re-layout or a data change.
  const widthValue = useSharedValue(0);
  const countValue = useSharedValue(0);
  const lastIndex = useSharedValue(-1);
  const grow = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    widthValue.set(width);
    countValue.set(count);
  }, [width, count, widthValue, countValue]);

  useEffect(() => {
    if (width <= 0) {
      return;
    }
    if (reduceMotion) {
      cancelAnimation(grow);
      grow.set(1);
      return;
    }
    grow.set(0);
    grow.set(
      withTiming(1, {
        duration: motion.sheet,
        easing: EASE_OUT,
      }),
    );
  }, [seriesKey, width, reduceMotion, grow]);

  const scrubTo = useCallback(
    (index: number) => {
      haptics.selection();
      onSelect(index);
    },
    [onSelect],
  );

  const pan = usePanGesture({
    // Horizontal drags scrub; vertical ones are left to the scroll view.
    activeOffsetX: [-8, 8],
    failOffsetY: [-12, 12],
    onActivate: event => {
      'worklet';
      const index = barIndexAt(event.x, widthValue.get(), countValue.get());
      if (index >= 0) {
        lastIndex.set(index);
        scheduleOnRN(scrubTo, index);
      }
    },
    onUpdate: event => {
      'worklet';
      const index = barIndexAt(event.x, widthValue.get(), countValue.get());
      // Only cross back to the RN runtime when the finger enters a new bar.
      if (index >= 0 && index !== lastIndex.get()) {
        lastIndex.set(index);
        scheduleOnRN(scrubTo, index);
      }
    },
  });

  const { bars, ticks } = layoutBars({
    values,
    width,
    height,
    topInset: TOP_INSET,
  });
  const hasData = values.some(value => value > 0);
  // An all-zero series has a meaningless "1" at the top of its axis.
  const shownTicks = hasData ? ticks : ticks.filter(tick => tick.value === 0);
  const labelIndices = axisLabelIndices(count, count <= 8 ? count : 5);
  const active = selectedIndex !== null && selectedIndex < count ? selectedIndex : null;

  const step = (delta: 1 | -1) => {
    if (count === 0) {
      return;
    }
    const from = active ?? (delta === 1 ? -1 : count);
    onSelect(Math.min(count - 1, Math.max(0, from + delta)));
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={active !== null ? { text: describeBar(active) } : undefined}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'increment') {
          step(1);
        } else if (event.nativeEvent.actionName === 'decrement') {
          step(-1);
        }
      }}
    >
      <View style={styles.plotRow}>
        <GestureDetector gesture={pan}>
          <Pressable
            testID={testID}
            style={[styles.plot, { height }]}
            onLayout={event => setWidth(event.nativeEvent.layout.width)}
            onPress={event => {
              const index = barIndexAt(event.nativeEvent.locationX, width, count);
              if (index < 0) {
                return;
              }
              haptics.selection();
              // Tapping the selected bar again clears the selection.
              onSelect(index === active ? null : index);
            }}
          >
            {width > 0 ? (
              <Svg width={width} height={height} pointerEvents="none">
                {shownTicks.map(tick => (
                  <Line
                    key={tick.value}
                    x1={0}
                    x2={width}
                    y1={tick.y}
                    y2={tick.y}
                    stroke={tick.value === 0 ? t.borderStrong : t.borderSubtle}
                    strokeWidth={StyleSheet.hairlineWidth}
                  />
                ))}
                {bars.map((bar, index) =>
                  bar.height > 0 ? (
                    <GrowingBar
                      // Bars are positional: one slot per day, never reordered.
                      key={index}
                      bar={bar}
                      grow={grow}
                      fill={t.accent}
                      opacity={active === null || active === index ? 1 : 0.3}
                    />
                  ) : null,
                )}
              </Svg>
            ) : null}
          </Pressable>
        </GestureDetector>
        <View style={[styles.tickColumn, { height }]}>
          {shownTicks.map(tick => (
            <Text
              key={tick.value}
              style={[styles.tickLabel, { color: t.textTertiary, top: tick.y - TICK_LINE / 2 }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {formatTick(tick.value)}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.axisRow}>
        {width > 0
          ? labelIndices.map(index => {
              const bar = bars.at(index);
              if (!bar) {
                return null;
              }
              // Labels center on their bar; one that would spill past the
              // plot (crowded 30-day charts) hugs that edge instead.
              const half = AXIS_LABEL_WIDTH / 2;
              const placement =
                bar.center - half < 0
                  ? ({ left: 0, textAlign: 'left' } as const)
                  : bar.center + half > width
                    ? ({ right: TICK_COLUMN, textAlign: 'right' } as const)
                    : ({ left: bar.center - half, textAlign: 'center' } as const);
              return (
                <Text
                  key={index}
                  style={[
                    styles.axisLabel,
                    placement,
                    { color: active === index ? t.textPrimary : t.textTertiary },
                  ]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                >
                  {axisLabels.at(index) ?? ''}
                </Text>
              );
            })
          : null}
      </View>
    </View>
  );
}

const GrowingBar = memo(function GrowingBar({
  bar,
  grow,
  fill,
  opacity,
}: {
  bar: BarRect;
  grow: SharedValue<number>;
  fill: string;
  opacity: number;
}) {
  const animatedProps = useAnimatedProps(() => ({
    d: barPath(growBar(bar, grow.get()), BAR_RADIUS),
  }));

  return <AnimatedPath animatedProps={animatedProps} fill={fill} opacity={opacity} />;
});

const styles = StyleSheet.create({
  plotRow: {
    flexDirection: 'row',
  },
  plot: {
    flex: 1,
  },
  tickColumn: {
    width: TICK_COLUMN,
  },
  tickLabel: {
    position: 'absolute',
    left: 6,
    right: 0,
    ...typeScale.caption2,
    lineHeight: TICK_LINE,
  },
  axisRow: {
    height: AXIS_ROW,
    marginTop: 4,
  },
  axisLabel: {
    position: 'absolute',
    top: 0,
    width: AXIS_LABEL_WIDTH,
    ...typeScale.caption2,
  },
});
