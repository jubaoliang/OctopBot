import { StyleSheet } from 'react-native';

/**
 * iOS HIG settings anatomy, expressed as reusable primitives:
 *
 * - `group`      — inset-grouped card: rounded, on `surface`, hairline border
 * - `groupLabel` — small uppercase-style section header above a card
 * - `row`        — 44pt+ row: leading tinted icon square, title, trailing
 *                  value text and/or chevron; destructive variants in red
 * - rows are Pressables at the call site (navigation / actions)
 *
 * All colors arrive via tokens — nothing is hardcoded here.
 */

export const settingsStyles = StyleSheet.create({
  group: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  groupLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIconSquare: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 180,
  },
  rowDestructive: {
    fontWeight: '500',
  },
});
