import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

/**
 * iOS inset-grouped settings anatomy (HIG "Lists and tables"):
 *
 * - `SettingsSection` — footnote label above a rounded card on `surface`
 * - `SettingsRow`     — 44pt+ row: title, optional trailing value, and a
 *                       checkmark (selection) or chevron (navigation);
 *                       separators inset to the text edge
 *
 * All colors arrive via tokens — nothing is hardcoded here.
 */
export function SettingsSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const t = useTokens();
  return (
    <View style={styles.section}>
      {title ? (
        <Text accessibilityRole="header" style={[styles.sectionLabel, { color: t.textTertiary }]}>
          {title}
        </Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: t.surface, borderColor: t.borderSubtle }]}>
        {children}
      </View>
      {footer ? (
        <Text style={[styles.sectionFooter, { color: t.textTertiary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

interface SettingsRowProps {
  title: string;
  /** Trailing secondary text (current value). */
  value?: string;
  /** Selection lists: shows a trailing checkmark and reports `selected`. */
  selected?: boolean;
  /** Navigation rows: shows a trailing chevron. */
  disclosure?: boolean;
  /** Destructive action: centered title in the danger color. */
  destructive?: boolean;
  /** The last row of a group draws no separator. */
  last?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function SettingsRow({
  title,
  value,
  selected,
  disclosure,
  destructive,
  last,
  onPress,
  testID,
}: SettingsRowProps) {
  const t = useTokens();
  const isChoice = selected !== undefined;

  return (
    <Pressable
      accessibilityRole={isChoice ? 'radio' : onPress ? 'button' : 'text'}
      accessibilityState={isChoice ? { selected } : undefined}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      disabled={!onPress}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: t.overlayPressed } : null]}
    >
      <View
        style={[
          styles.rowBody,
          { borderBottomColor: t.borderSubtle },
          last ? styles.rowBodyLast : null,
        ]}
      >
        <Text
          style={[
            styles.rowTitle,
            { color: destructive ? t.danger : t.textBody },
            destructive ? styles.rowTitleCentered : null,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {value ? (
          <Text
            style={[styles.rowValue, { color: t.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {value}
          </Text>
        ) : null}
        {selected ? <Check size={20} strokeWidth={2.5} color={t.accent} /> : null}
        {disclosure ? <ChevronRight size={18} color={t.textPlaceholder} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 6,
  },
  sectionLabel: {
    ...typeScale.footnote,
    paddingHorizontal: layout.screenMargin,
  },
  sectionFooter: {
    ...typeScale.footnote,
    paddingHorizontal: layout.screenMargin,
  },
  group: {
    borderRadius: radius.card,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    paddingLeft: layout.screenMargin,
  },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: layout.rowMinHeight,
    paddingRight: layout.screenMargin,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBodyLast: {
    borderBottomWidth: 0,
  },
  rowTitle: {
    ...typeScale.body,
    flexShrink: 0,
    flexGrow: 1,
  },
  rowTitleCentered: {
    textAlign: 'center',
    fontWeight: '500',
  },
  rowValue: {
    ...typeScale.body,
    flexShrink: 1,
    textAlign: 'right',
  },
});
