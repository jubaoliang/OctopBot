import { useState } from 'react';

import { IconButton } from '@/components/IconButton';
import { IconPlus } from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { ActionSheet } from '@/platform/action-sheet';
import { haptics } from '@/platform/haptics';
import type { AttachButtonProps } from '@/platform/attach-button.types';
import { useTokens } from '@/theme';

/**
 * The composer's attach control: a "+" that offers photos, the camera and files.
 *
 * Every target renders this; only the presentation behind it differs. Here the
 * app draws its own action sheet (`src/platform/action-sheet.tsx`); on iOS the
 * control is a system menu instead (see `attach-button.ios.tsx`).
 */

/** Visual frame of the "+" glyph; `hitSlop` makes the target 44pt. */
const GLYPH_FRAME = 28;

export function AttachButton({ onPick, disabled }: AttachButtonProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const [sourceOpen, setSourceOpen] = useState(false);

  return (
    <>
      <IconButton
        label={strings.a11y.attach}
        testID="composer-attach"
        size={GLYPH_FRAME}
        disabled={disabled}
        onPress={() => {
          haptics.impact('light');
          setSourceOpen(true);
        }}
      >
        <IconPlus width={22} height={22} color={t.textSecondary} />
      </IconButton>
      <ActionSheet
        visible={sourceOpen}
        title={strings.attachments.sourceTitle}
        items={[
          {
            label: strings.attachments.library,
            onPress: () => onPick('library'),
          },
          { label: strings.attachments.camera, onPress: () => onPick('camera') },
          { label: strings.attachments.files, onPress: () => onPick('files') },
        ]}
        cancelLabel={strings.common.cancel}
        dismissLabel={strings.a11y.closeSheet}
        onClose={() => setSourceOpen(false)}
        testID="attach-sheet"
      />
    </>
  );
}
