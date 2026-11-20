import { StyleSheet, Text, View } from 'react-native';

import { continuousCorners, typeScale, useTokens } from '@/theme';

/** Cap before the capsule stops growing; larger counts render as "99+". */
const MAX_BADGE_COUNT = 99;

function badgeLabel(count: number): string {
  return count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(count);
}

/**
 * Unread capsule (solid `accent`, inverse label) and the bare dot used
 * where a number would shout. Row/segment badges across the app render
 * through this one component so shape and color cannot drift.
 */
export function UnreadBadge({ count }: { count: number }) {
  const t = useTokens();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={badgeLabel(count)}
      style={[styles.capsule, { backgroundColor: t.accent }, count > 9 ? styles.wide : null]}
    >
      <Text
        style={[styles.label, { color: t.textInverse }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {badgeLabel(count)}
      </Text>
    </View>
  );
}

/** Accent dot for "something unread" where a count is too loud. */
export function UnreadDot() {
  const t = useTokens();
  return <View style={[styles.dot, { backgroundColor: t.accent }]} />;
}

const styles = StyleSheet.create({
  capsule: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    ...continuousCorners,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  wide: {
    paddingHorizontal: 6,
  },
  label: {
    ...typeScale.caption2,
    fontWeight: '600',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
