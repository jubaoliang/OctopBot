import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/platform/haptics';
import { continuousCorners, layout, motion, radius, typeScale, useTokens } from '@/theme';

export interface OverflowMenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface OverflowMenuProps {
  visible: boolean;
  items: OverflowMenuItem[];
  onClose: () => void;
  /** Accessibility label for the dismiss layer. */
  dismissLabel: string;
}

/** Same strong ease-out the rest of the chrome uses. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Header bar ≈ 52pt; sit the menu just under the kebab.
const HEADER_OFFSET = 52;

/**
 * Header overflow menu — a compact card anchored under the kebab, not a
 * system alert/action sheet. Transparent dismiss layer, surface card with
 * soft lift; enters with a short fade+scale from the trailing corner.
 */
export function OverflowMenu({ visible, items, onClose, dismissLabel }: OverflowMenuProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  if (items.length === 0) {
    return null;
  }

  const top = insets.top + HEADER_OFFSET;
  // Match AppHeader's trailing inset so the card lines up with the kebab.
  const trailing = layout.screenMargin - (layout.hitTarget - 20) / 2;

  const cardEntering = reduceMotion
    ? FadeIn.duration(motion.press)
    : ZoomIn.duration(motion.state)
        .easing(EASE_OUT)
        .withInitialValues({ transform: [{ scale: 0.94 }] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View
          entering={FadeIn.duration(motion.press)}
          exiting={FadeOut.duration(motion.press)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            style={styles.dismiss}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          entering={cardEntering}
          style={[
            styles.card,
            continuousCorners,
            {
              top,
              right: trailing,
              backgroundColor: t.surface,
              borderColor: t.borderSubtle,
              shadowColor: t.shadow,
            },
          ]}
        >
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  styles.row,
                  !last
                    ? {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: t.borderSubtle,
                      }
                    : null,
                  pressed ? { backgroundColor: t.overlayPressed } : null,
                ]}
                onPress={() => {
                  haptics.selection();
                  onClose();
                  // Defer so the menu can start dismissing before navigation.
                  requestAnimationFrame(() => {
                    item.onPress();
                  });
                }}
              >
                <Text
                  style={[styles.rowLabel, { color: item.destructive ? t.danger : t.textBody }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dismiss: {
    ...StyleSheet.absoluteFill,
    // Catch taps without a heavy modal scrim — this is chrome, not a dialog.
    backgroundColor: 'transparent',
  },
  card: {
    position: 'absolute',
    minWidth: 180,
    maxWidth: 260,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    // Soft lift; elevation is static (animating it re-renders Android shadows).
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  row: {
    minHeight: layout.rowMinHeight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  rowLabel: {
    ...typeScale.body,
  },
});
