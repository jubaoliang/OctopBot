import { Button, Host, Image, Menu } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled, padding } from '@expo/ui/swift-ui/modifiers';

import { useI18n } from '@/i18n/I18nProvider';
import type { AttachButtonProps } from '@/platform/attach-button.types';
import { useTheme } from '@/theme';

/**
 * iOS attach control: a system menu, not a sheet of our own.
 *
 * A menu is what the HIG asks for when the choices belong to one control —
 * it opens anchored to "+", leaves the conversation visible, and carries the
 * system's own animation, blur, haptics, Dynamic Type and dismissal. The
 * trigger stays the composer's grey "+", drawn by SF Symbols at the size and
 * colour the composer uses.
 */
export function AttachButton({ onPick, disabled: isDisabled }: AttachButtonProps) {
  const { tokens: t, resolvedMode } = useTheme();
  const { t: strings } = useI18n();

  return (
    <Host matchContents colorScheme={resolvedMode}>
      <Menu
        testID="composer-attach"
        label={
          <Image
            systemName="plus"
            size={22}
            color={t.textSecondary}
            // 22pt glyph + 11pt of padding on each side = the 44pt target.
            modifiers={[padding({ all: 11 })]}
          />
        }
        modifiers={[accessibilityLabel(strings.a11y.attach), disabled(Boolean(isDisabled))]}
      >
        <Button label={strings.attachments.library} onPress={() => onPick('library')} />
        <Button label={strings.attachments.camera} onPress={() => onPick('camera')} />
        <Button label={strings.attachments.files} onPress={() => onPick('files')} />
      </Menu>
    </Host>
  );
}
