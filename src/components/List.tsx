import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

/** Leading glyph column width; separators indent to the text edge past it. */
const LEADING_INSET = 60;

/**
 * Inset-grouped list, per the iOS grouped style: one rounded card on the
 * surface color, hairline separators between rows, an optional section
 * header and footer carrying the surrounding explanation.
 */
export function ListGroup({
  header,
  footer,
  children,
}: {
  header?: string;
  footer?: string;
  children: ReactNode;
}) {
  const t = useTokens();
  return (
    <View style={styles.group}>
      {header ? (
        <Text accessibilityRole="header" style={[styles.header, { color: t.textTertiary }]}>
          {header}
        </Text>
      ) : null}
      <View style={[styles.card, continuousCorners, { backgroundColor: t.surface }]}>
        {children}
      </View>
      {footer ? <Text style={[styles.footer, { color: t.textTertiary }]}>{footer}</Text> : null}
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Avatar or icon shown in the leading column. */
  leading?: ReactNode;
  /** Trailing secondary text, e.g. a status word. */
  value?: string;
  /** Trailing element before the chevron, e.g. a status dot and label. */
  accessory?: ReactNode;
  /** Navigation row: a disclosure chevron. */
  disclosure?: boolean;
  /** Choice row: a checkmark when selected (lists-and-tables.md › Best practices). */
  selected?: boolean;
  /** Destructive action: title in the danger color. */
  destructive?: boolean;
  /** Unavailable row: text and leading glyph recede to the disabled tint. */
  muted?: boolean;
  /** The last row of the group draws no separator. */
  last?: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityHint?: string;
}

/**
 * One list row. Selection shows a checkmark rather than only a highlight, so
 * the current choice is visible after the tap as well as during it; controls
 * stay at least one 44pt target tall whatever the content.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  value,
  accessory,
  disclosure,
  selected,
  destructive,
  muted,
  last,
  onPress,
  testID,
  accessibilityHint,
}: ListRowProps) {
  const t = useTokens();
  const isChoice = selected !== undefined;

  return (
    <Pressable
      accessibilityRole={isChoice ? 'radio' : onPress ? 'button' : 'text'}
      accessibilityState={isChoice ? { selected } : undefined}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityHint={accessibilityHint}
      disabled={!onPress}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [pressed && onPress ? { backgroundColor: t.overlayPressed } : null]}
    >
      <View style={styles.rowBody}>
        {leading ? (
          <View style={[styles.leading, muted ? styles.mutedLeading : null]}>{leading}</View>
        ) : null}
        <View style={styles.text}>
          <Text
            style={[
              styles.title,
              { color: destructive ? t.danger : muted ? t.textTertiary : t.textBody },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: muted ? t.textPlaceholder : t.textSecondary }]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? (
          <Text style={[styles.value, { color: t.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {accessory}
        {selected ? <Check size={20} strokeWidth={2.5} color={t.accent} /> : null}
        {disclosure ? <ChevronRight size={18} color={t.textPlaceholder} /> : null}
      </View>
      {last ? null : (
        <View
          style={[
            styles.separator,
            {
              backgroundColor: t.separator,
              marginLeft: leading ? LEADING_INSET : layout.screenMargin,
            },
          ]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 6,
  },
  header: {
    ...typeScale.footnote,
    paddingHorizontal: layout.screenMargin,
  },
  footer: {
    ...typeScale.footnote,
    paddingHorizontal: layout.screenMargin,
  },
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: layout.rowMinHeight,
    paddingHorizontal: layout.screenMargin,
    paddingVertical: 10,
  },
  leading: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedLeading: {
    opacity: 0.45,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typeScale.body,
  },
  subtitle: {
    ...typeScale.footnote,
  },
  value: {
    ...typeScale.body,
    flexShrink: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
