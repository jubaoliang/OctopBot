import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { haptics } from '@/platform/haptics';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

export interface ActionSheetItem {
  label: string;
  onPress: () => void;
  /** Red label for an action that deletes, discards or disconnects. */
  destructive?: boolean;
}

export interface ActionSheetProps {
  visible: boolean;
  /** What the choice is about, e.g. "Add image". */
  title: string;
  /** Optional explanatory line under the title. */
  message?: string;
  items: ActionSheetItem[];
  cancelLabel: string;
  dismissLabel: string;
  onClose: () => void;
  testID?: string;
}

/**
 * Action sheet — the iOS answer to "one action, several ways to do it".
 *
 * Apple draws the choice set as a card of 20pt labels, destructive options
 * first, with Cancel in its own card below (action-sheets.md › Best
 * practices: "Use an action sheet — not an alert — to offer choices related
 * to an intentional action."). It is the app's replacement for the
 * three-button `Alert` that used to sit behind the composer's + button.
 */
export function ActionSheet({
  visible,
  title,
  message,
  items,
  cancelLabel,
  dismissLabel,
  onClose,
  testID,
}: ActionSheetProps) {
  const t = useTokens();
  // Destructive first, matching the system order.
  const ordered = [...items].sort(
    (a, b) => Number(Boolean(b.destructive)) - Number(Boolean(a.destructive)),
  );

  const choose = (item: ActionSheetItem) => {
    haptics.selection();
    onClose();
    // Let the sheet start leaving before the action pushes a screen.
    requestAnimationFrame(() => {
      item.onPress();
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      dismissLabel={dismissLabel}
      grabber={false}
      testID={testID}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.textSecondary }]}>{title}</Text>
        {message ? (
          <Text style={[styles.message, { color: t.textTertiary }]}>{message}</Text>
        ) : null}
      </View>

      <View style={[styles.card, continuousCorners, { backgroundColor: t.surface }]}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {ordered.map((item, index) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              testID={testID ? `${testID}-${index}` : undefined}
              onPress={() => choose(item)}
              style={({ pressed }) => [
                styles.row,
                index < ordered.length - 1
                  ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }
                  : null,
                pressed ? { backgroundColor: t.overlayPressed } : null,
              ]}
            >
              <Text
                style={[styles.rowLabel, { color: item.destructive ? t.danger : t.accent }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={[styles.card, continuousCorners, { backgroundColor: t.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          testID={testID ? `${testID}-cancel` : undefined}
          onPress={onClose}
          style={({ pressed }) => [
            styles.row,
            pressed ? { backgroundColor: t.overlayPressed } : null,
          ]}
        >
          <Text style={[styles.rowLabel, styles.cancelLabel, { color: t.textPrimary }]}>
            {cancelLabel}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 32,
    paddingTop: 4,
    paddingBottom: 14,
  },
  title: {
    ...typeScale.footnote,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    ...typeScale.footnote,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: radius.actionCard,
    overflow: 'hidden',
  },
  cardContent: {
    flexGrow: 0,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenMargin,
    paddingVertical: 12,
  },
  rowLabel: {
    ...typeScale.title3,
    fontWeight: '400',
    textAlign: 'center',
  },
  cancelLabel: {
    fontWeight: '600',
  },
});
