import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Pin } from 'lucide-react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';

import type { DrawerThread } from '@/components/AppDrawer';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { layout, typeScale, useTokens } from '@/theme';

interface DrawerThreadRowProps {
  thread: DrawerThread;
  title: string;
  onOpen: () => void;
  onPin: () => void;
  onDelete: () => void;
}

/**
 * Action rail under the row. Both rails sit behind every row all the time
 * (the swipeable stacks them as absolute fills), so a rail paints only
 * while the row is actually dragged off its own side — solid then, and
 * not at all at rest. That keeps Pin/Delete from showing through whenever
 * an ancestor is drawn translucent or the row is not opaque for a frame.
 */
function ActionRail({
  side,
  translation,
  backgroundColor,
  label,
  accessibilityLabel,
  testID,
  onPress,
}: {
  side: 'left' | 'right';
  /** Row offset in points: positive uncovers the left rail, negative the right. */
  translation: SharedValue<number>;
  backgroundColor: string;
  label: string;
  accessibilityLabel: string;
  testID: string;
  onPress: () => void;
}) {
  const t = useTokens();
  const style = useAnimatedStyle(() => {
    const offset = translation.get();
    const uncovered = side === 'left' ? offset > 0 : offset < 0;
    return { opacity: uncovered ? 1 : 0 };
  });

  return (
    <Animated.View style={[styles.actionRail, { backgroundColor }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onPress={onPress}
        style={styles.actionHit}
      >
        <Text style={[styles.actionLabel, { color: t.textInverse }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Drawer task-tree child: trailing swipe → delete, leading swipe → pin/unpin.
 * Long-press opens the same actions (Reduce Motion and Maestro-friendly).
 */
export function DrawerThreadRow({ thread, title, onOpen, onPin, onDelete }: DrawerThreadRowProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const reduceMotion = useReducedMotion();
  const swipeRef = useRef<SwipeableMethods>(null);

  const confirmDelete = () => {
    swipeRef.current?.close();
    haptics.notify('warning');
    Alert.alert(strings.drawer.deleteThreadTitle, strings.drawer.deleteThreadMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: strings.drawer.deleteThread,
        style: 'destructive',
        onPress: () => {
          haptics.impact('medium');
          onDelete();
        },
      },
    ]);
  };

  const pin = () => {
    swipeRef.current?.close();
    haptics.selection();
    onPin();
  };

  const showActions = () => {
    swipeRef.current?.close();
    haptics.selection();
    Alert.alert(title, undefined, [
      {
        text: thread.pinned ? strings.drawer.unpin : strings.drawer.pin,
        onPress: pin,
      },
      {
        text: strings.drawer.deleteThread,
        style: 'destructive',
        // Defer past the action-sheet dismiss so the confirm Alert is not dropped.
        onPress: () => {
          setTimeout(confirmDelete, 0);
        },
      },
      { text: strings.common.cancel, style: 'cancel' },
    ]);
  };

  const pinLabel = thread.pinned ? strings.drawer.unpin : strings.drawer.pin;

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={(_progress, translation) => (
        <ActionRail
          side="left"
          translation={translation}
          backgroundColor={t.accent}
          label={pinLabel}
          accessibilityLabel={pinLabel}
          testID={`drawer-pin-${thread.threadId}`}
          onPress={pin}
        />
      )}
      renderRightActions={(_progress, translation) => (
        <ActionRail
          side="right"
          translation={translation}
          backgroundColor={t.danger}
          label={strings.drawer.deleteThread}
          accessibilityLabel={strings.drawer.deleteThread}
          testID={`drawer-delete-${thread.threadId}`}
          onPress={confirmDelete}
        />
      )}
      overshootLeft={false}
      overshootRight={false}
      overshootFriction={reduceMotion ? 1 : 8}
      friction={2}
      dragOffsetFromLeft={12}
      dragOffsetFromRight={-12}
      animationOptions={reduceMotion ? { duration: 1 } : undefined}
      childrenContainerStyle={[styles.childrenContainer, { backgroundColor: t.bg }]}
      containerStyle={[styles.swipeContainer, { backgroundColor: t.bg }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        testID={`drawer-thread-${thread.threadId}`}
        style={({ pressed }) => [
          styles.childRow,
          { backgroundColor: pressed ? t.overlayPressed : t.bg },
        ]}
        onPress={onOpen}
        onLongPress={showActions}
        delayLongPress={350}
      >
        <View style={styles.childInner}>
          {thread.pinned ? <Pin size={14} color={t.textTertiary} /> : null}
          <Text
            style={[styles.childName, { color: t.textBody }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  childrenContainer: {
    width: '100%',
  },
  childRow: {
    // Align with AppDrawer group label (12 pad + 20 avatar + 8 gap = 40).
    width: '100%',
    minHeight: layout.hitTarget,
    paddingLeft: 40,
    paddingRight: 12,
    justifyContent: 'center',
  },
  childInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  childName: {
    ...typeScale.subheadline,
    flexShrink: 1,
  },
  actionRail: {
    width: 88,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  actionHit: {
    flex: 1,
    minHeight: layout.hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionLabel: {
    ...typeScale.footnote,
    fontWeight: '600',
  },
});
