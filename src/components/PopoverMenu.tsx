import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutRectangle,
} from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { continuousCorners, layout, motion, radius, typeScale, useTokens } from '@/theme';

export interface PopoverMenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
}

export interface PopoverMenuProps {
  visible: boolean;
  /** Window coordinates of the control that opened the menu. */
  anchor: LayoutRectangle | null;
  items: PopoverMenuItem[];
  onClose: () => void;
  /** Localized a11y label for the outside-tap dismiss control. */
  dismissLabel: string;
  testID?: string;
}

const MENU_MIN_WIDTH = 200;
const GAP = 6;
const EDGE = 8;

/**
 * HIG pull-down menu for disambiguation (e.g. attach → library / camera).
 *
 * Appears next to the tapped control, dismisses on outside tap (no Cancel
 * row), and stays light — preferred over an action sheet for routine
 * choosers (WWDC20 / Menus). Destructive / confirm flows still belong in
 * an action sheet or alert.
 */
export function PopoverMenu({
  visible,
  anchor,
  items,
  onClose,
  dismissLabel,
  testID,
}: PopoverMenuProps) {
  const t = useTokens();
  const reduceMotion = useReducedMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Estimate first; refine after onLayout (no useEffect reset).
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const estimatedHeight = items.length * layout.hitTarget;

  if (!visible || !anchor) {
    return null;
  }

  const menuWidth = Math.max(measured?.width ?? MENU_MIN_WIDTH, MENU_MIN_WIDTH);
  const menuHeight = measured?.height ?? estimatedHeight;
  // Prefer below the trigger; flip above when the bottom edge would clip.
  const belowY = anchor.y + anchor.height + GAP;
  const aboveY = anchor.y - GAP - menuHeight;
  const placeBelow = belowY + menuHeight + EDGE <= windowHeight || aboveY < EDGE;
  const top = placeBelow
    ? Math.min(belowY, windowHeight - menuHeight - EDGE)
    : Math.max(EDGE, aboveY);
  // Align to the trigger's leading edge; clamp so the menu stays on-screen.
  const left = Math.min(Math.max(EDGE, anchor.x), Math.max(EDGE, windowWidth - menuWidth - EDGE));

  const enter = reduceMotion ? undefined : FadeIn.duration(motion.state);
  const exit = reduceMotion ? undefined : FadeOut.duration(motion.state);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root} testID={testID}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          testID={testID ? `${testID}-dismiss` : undefined}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <Animated.View
          entering={enter}
          exiting={exit}
          onLayout={event => {
            const { width, height } = event.nativeEvent.layout;
            setMeasured(prev =>
              prev?.width === width && prev.height === height ? prev : { width, height },
            );
          }}
          style={[
            styles.menu,
            {
              top,
              left,
              minWidth: MENU_MIN_WIDTH,
              backgroundColor: t.surfaceRaised,
              borderColor: t.borderSubtle,
              shadowColor: t.shadow,
            },
          ]}
          accessibilityRole="menu"
        >
          {items.map((item, index) => (
            <View key={item.label}>
              {index > 0 ? (
                <View style={[styles.separator, { backgroundColor: t.borderSubtle }]} />
              ) : null}
              <PressableScale
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                testID={item.testID}
                onPress={() => {
                  onClose();
                  requestAnimationFrame(() => {
                    item.onPress();
                  });
                }}
                scaleTo={1}
                dimTo={0.6}
                style={styles.row}
              >
                <Text
                  style={[styles.rowLabel, { color: item.destructive ? t.danger : t.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </PressableScale>
            </View>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    borderRadius: radius.card,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    // Soft lift — menus should feel local, not like a sheet.
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: layout.hitTarget,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLabel: {
    ...typeScale.body,
  },
});
