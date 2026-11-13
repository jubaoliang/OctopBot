import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/PressableScale';
import { continuousCorners, layout, motion, radius, typeScale, useTokens } from '@/theme';

export interface ActionSheetAction {
  label: string;
  onPress: () => void;
  /** Destructive actions render in the danger color (HIG). */
  destructive?: boolean;
  testID?: string;
}

export interface ActionSheetProps {
  visible: boolean;
  /** Optional title above the action group — keep short or omit. */
  title?: string;
  actions: ActionSheetAction[];
  cancelLabel: string;
  onClose: () => void;
  testID?: string;
}

/**
 * HIG-style action sheet for confirmation or destructive choices (delete,
 * discard, …). Anchored to the bottom with a Cancel control.
 *
 * For the composer attach chooser (photos / camera / files), prefer the
 * inline `AttachTray` that launches system pickers — not this sheet.
 */
export function ActionSheet({
  visible,
  title,
  actions,
  cancelLabel,
  onClose,
  testID,
}: ActionSheetProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root} testID={testID}>
        <Animated.View
          entering={FadeIn.duration(motion.state)}
          exiting={FadeOut.duration(motion.state)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            style={[styles.scrim, { backgroundColor: t.scrim }]}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.duration(motion.sheet)}
          exiting={SlideOutDown.duration(motion.sheet)}
          style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          <View
            style={[styles.group, { backgroundColor: t.surfaceRaised }]}
            accessibilityRole="menu"
          >
            {title ? (
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: t.textTertiary }]}
                numberOfLines={2}
              >
                {title}
              </Text>
            ) : null}
            {actions.map((action, index) => (
              <View key={action.label}>
                {index > 0 || title ? (
                  <View style={[styles.separator, { backgroundColor: t.borderSubtle }]} />
                ) : null}
                <PressableScale
                  accessibilityRole="menuitem"
                  accessibilityLabel={action.label}
                  testID={action.testID}
                  onPress={() => {
                    onClose();
                    // Defer past dismiss so the next native picker is not
                    // dropped while the Modal is still tearing down.
                    requestAnimationFrame(() => {
                      action.onPress();
                    });
                  }}
                  scaleTo={1}
                  dimTo={0.6}
                  style={styles.row}
                >
                  <Text
                    style={[styles.rowLabel, { color: action.destructive ? t.danger : t.accent }]}
                  >
                    {action.label}
                  </Text>
                </PressableScale>
              </View>
            ))}
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            testID={testID ? `${testID}-cancel` : undefined}
            onPress={onClose}
            scaleTo={0.98}
            dimTo={0.7}
            style={[styles.cancel, { backgroundColor: t.surfaceRaised }]}
          >
            <Text style={[styles.cancelLabel, { color: t.accent }]}>{cancelLabel}</Text>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  sheetWrap: {
    // Horizontal inset matching iOS action-sheet margins on compact widths.
    paddingHorizontal: 8,
    gap: 8,
  },
  group: {
    borderRadius: radius.sheet,
    ...continuousCorners,
    overflow: 'hidden',
  },
  title: {
    ...typeScale.footnote,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: layout.hitTarget + 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: {
    ...typeScale.body,
    fontWeight: '400',
  },
  cancel: {
    borderRadius: radius.sheet,
    ...continuousCorners,
    minHeight: layout.hitTarget + 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cancelLabel: {
    ...typeScale.headline,
  },
});
