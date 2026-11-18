import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { Pin } from 'lucide-react-native';

import { ActionSheet } from '@/components/ActionSheet';
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
 * Drawer task-tree child. Actions live behind a long-press menu — no swipe
 * buttons: a row this narrow cannot carry two 88pt action panels without the
 * title disappearing behind them, and a menu is one consistent gesture on every
 * platform.
 */
export function DrawerThreadRow({ thread, title, onOpen, onPin, onDelete }: DrawerThreadRowProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const [actionsOpen, setActionsOpen] = useState(false);

  const confirmDelete = () => {
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

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={strings.a11y.threadActions}
        testID={`drawer-thread-${thread.threadId}`}
        style={({ pressed }) => [
          styles.childRow,
          { backgroundColor: pressed ? t.overlayPressed : t.bg },
        ]}
        onPress={onOpen}
        onLongPress={() => {
          haptics.selection();
          setActionsOpen(true);
        }}
        delayLongPress={350}
      >
        {thread.pinned ? <Pin size={14} color={t.textTertiary} /> : null}
        <Text
          style={[styles.childName, { color: t.textBody }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
      </Pressable>

      <ActionSheet
        visible={actionsOpen}
        title={title}
        items={[
          {
            label: thread.pinned ? strings.drawer.unpin : strings.drawer.pin,
            onPress: () => {
              haptics.selection();
              onPin();
            },
          },
          {
            label: strings.drawer.deleteThread,
            destructive: true,
            // Defer past the sheet dismissal so the confirmation is not dropped.
            onPress: () => {
              setTimeout(confirmDelete, 0);
            },
          },
        ]}
        cancelLabel={strings.common.cancel}
        dismissLabel={strings.a11y.closeSheet}
        onClose={() => setActionsOpen(false)}
        testID="thread-actions"
      />
    </>
  );
}

const styles = StyleSheet.create({
  childRow: {
    // Align with AppDrawer group label (12 pad + 20 avatar + 8 gap = 40).
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: layout.hitTarget,
    paddingLeft: 40,
    paddingRight: 12,
    justifyContent: 'flex-start',
  },
  childName: {
    ...typeScale.subheadline,
    flexShrink: 1,
  },
});
