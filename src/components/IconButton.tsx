import { StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { PressableScale } from '@/components/PressableScale';
import { layout } from '@/theme';

interface IconButtonProps {
  /** Localized label — icon-only buttons are invisible to VoiceOver without one. */
  label: string;
  onPress?: () => void;
  children: ReactNode;
  /**
   * Visual frame in points. The touch target is always at least 44pt: a
   * smaller frame is padded out with hitSlop instead of growing the glyph.
   */
  size?: number;
  testID?: string;
  disabled?: boolean;
}

/** Icon-only button with a guaranteed 44pt touch target and dim-on-press. */
export function IconButton({
  label,
  onPress,
  children,
  size = layout.hitTarget,
  testID,
  disabled,
}: IconButtonProps) {
  const slop = Math.max(0, (layout.hitTarget - size) / 2);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      hitSlop={slop}
      scaleTo={0.9}
      dimTo={0.5}
      style={[styles.frame, { width: size, height: size }]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
