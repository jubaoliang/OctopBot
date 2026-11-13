import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

interface CollapsibleProps {
  expanded: boolean;
  children: ReactNode;
}

/**
 * Disclosure body that opens by growing a clipped box to its content height.
 *
 * The content is never faded, moved or kept alive after it has left the
 * layout: the clip reveals it top-down while the siblings below ride the
 * same height, so nothing can overlap or show through mid-animation. The
 * children mount on first expand and unmount once the collapse has finished.
 */
export function Collapsible({ expanded, children }: CollapsibleProps) {
  const [present, setPresent] = useState(expanded);
  if (expanded && !present) {
    setPresent(true);
  }

  const contentHeight = useSharedValue(0);
  const open = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    open.set(
      withTiming(expanded ? 1 : 0, { duration: motion.state, easing: EASE_OUT }, finished => {
        if (finished && !expanded) {
          scheduleOnRN(setPresent, false);
        }
      }),
    );
  }, [expanded, open]);

  const clipStyle = useAnimatedStyle(() => ({
    height: contentHeight.get() * open.get(),
  }));

  return (
    <Animated.View style={[styles.clip, clipStyle]}>
      {present ? (
        // Out of flow so it keeps its natural height while the clip animates.
        <View
          style={styles.content}
          onLayout={event => {
            contentHeight.set(event.nativeEvent.layout.height);
          }}
        >
          {children}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    width: '100%',
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
