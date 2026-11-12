import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider';
import { continuousCorners, radius, typeScale, useTokens } from '@/theme';

/**
 * Empty state: a quiet glyph, one line saying what is missing, one line
 * saying how to change that. Never a bare dash or a blank screen.
 */
export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  const t = useTokens();
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={[styles.emptyIcon, { backgroundColor: t.overlaySubtle }]}>{icon}</View>
      ) : null}
      <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>{title}</Text>
      {hint ? <Text style={[styles.emptyHint, { color: t.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

// Slow opacity pulse; Reanimated honors Reduce Motion and holds it still.
const pulse = {
  animationName: {
    from: { opacity: 1 },
    to: { opacity: 0.45 },
  },
  animationDuration: 900,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
} as const;

/**
 * Placeholder rows shown while a list loads — the same footprint as the
 * real rows (avatar + two text lines), so content does not jump on arrival.
 */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  const t = useTokens();
  const { t: strings } = useI18n();
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={strings.common.loading}
      style={[styles.skeletonList, pulse]}
    >
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={[styles.skeletonRow, { backgroundColor: t.surface }]}>
          <View style={[styles.skeletonAvatar, { backgroundColor: t.overlaySubtle }]} />
          <View style={styles.skeletonLines}>
            <View
              style={[
                styles.skeletonLine,
                styles.skeletonLineShort,
                { backgroundColor: t.overlaySubtle },
              ]}
            />
            <View style={[styles.skeletonLine, { backgroundColor: t.overlaySubtle }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    marginTop: 96,
    gap: 6,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    ...typeScale.headline,
    textAlign: 'center',
  },
  emptyHint: {
    ...typeScale.subheadline,
    textAlign: 'center',
  },
  skeletonList: {
    gap: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.card,
    ...continuousCorners,
    padding: 14,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  skeletonLines: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    width: '80%',
  },
  skeletonLineShort: {
    width: '45%',
  },
});
