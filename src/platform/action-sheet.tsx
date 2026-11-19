/**
 * Action sheet capability wrapper.
 *
 * Every target gets the same call site; only the presentation differs. iOS
 * hands the choice set to UIKit (`action-sheet.ios.tsx` → `ActionSheetIOS`),
 * so it matches every other system sheet in the OS. Android and the remaining
 * targets draw `components/ActionSheet`, which keeps the same anatomy — the
 * choice card, Cancel in its own card below, destructive options first.
 */
export {
  ActionSheet,
  type ActionSheetItem,
  type ActionSheetProps,
} from '@/components/ActionSheet';
