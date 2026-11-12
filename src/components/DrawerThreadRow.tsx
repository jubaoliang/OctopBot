import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Pin } from 'lucide-react-native';
import { useReducedMotion } from 'react-native-reanimated';

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

  const renderLeft = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={thread.pinned ? strings.drawer.unpin : strings.drawer.pin}
      testID={`drawer-pin-${thread.threadId}`}
      onPress={pin}
      style={[styles.action, { backgroundColor: t.accent }]}
    >
      <Text style={[styles.actionLabel, { color: t.textInverse }]} numberOfLines={1}>
        {thread.pinned ? strings.drawer.unpin : strings.drawer.pin}
      </Text>
    </Pressable>
  );

  const renderRight = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.drawer.deleteThread}
      testID={`drawer-delete-${thread.threadId}`}
      onPress={confirmDelete}
      style={[styles.action, { backgroundColor: t.danger }]}
    >
      <Text style={[styles.actionLabel, { color: t.textInverse }]} numberOfLines={1}>
        {strings.drawer.deleteThread}
      </Text>
    </Pressable>
  );

  const row = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={`drawer-thread-${thread.threadId}`}
      style={({ pressed }) => [
        styles.childRow,
        // Opaque fill so swipe actions stay hidden behind the row at rest.
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
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeft}
      renderRightActions={renderRight}
      overshootLeft={false}
      overshootRight={false}
      overshootFriction={reduceMotion ? 1 : 8}
      friction={2}
      dragOffsetFromLeft={12}
      dragOffsetFromRight={-12}
      animationOptions={reduceMotion ? { duration: 1 } : undefined}
    >
      {row}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  childRow: {
    // Align with AppDrawer group label (12 pad + 20 avatar + 8 gap = 40).
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
  action: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionLabel: {
    ...typeScale.footnote,
    fontWeight: '600',
  },
});
