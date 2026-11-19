import { useEffect, useRef } from 'react';
import { ActionSheetIOS } from 'react-native';

import type { ActionSheetItem, ActionSheetProps } from '@/components/ActionSheet';

export type { ActionSheetItem, ActionSheetProps };

/**
 * iOS action sheet, presented by the system.
 *
 * The system sheet already carries the HIG anatomy — title, the destructive
 * option first, Cancel detached below, blur, Dynamic Type, the iPad popover —
 * so the app draws none of it. Presentation is imperative, so one sheet is
 * shown per `visible` edge and the component itself renders nothing.
 */
export function ActionSheet({ visible, title, message, items, cancelLabel, onClose }: ActionSheetProps) {
  const presenting = useRef(false);

  useEffect(() => {
    if (!visible || presenting.current) {
      return;
    }
    presenting.current = true;

    // Destructive first, matching the system order the drawn sheet uses.
    const ordered: ActionSheetItem[] = [...items].sort(
      (a, b) => Number(Boolean(b.destructive)) - Number(Boolean(a.destructive)),
    );
    const options = [...ordered.map(item => item.label), cancelLabel];
    const destructiveIndex = ordered.findIndex(item => item.destructive);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
      },
      index => {
        presenting.current = false;
        // The sheet is already gone at this point, so update the owner first
        // and run the action on the state it leaves behind.
        onClose();
        ordered[index]?.onPress();
      },
    );
  }, [cancelLabel, items, message, onClose, title, visible]);

  return null;
}
