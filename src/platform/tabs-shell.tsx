import { NativeTabs } from 'expo-router/native-tabs';

import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTokens } from '@/theme';

/**
 * The tab bar is the platform's own — `UITabBar` on iOS, the Material bottom
 * navigation on Android — through react-native-screens.
 *
 * Using the system control is not decoration: it brings the platform's
 * selection behaviour (a ripple on touch, the active state settling when the
 * finger lifts — no press-and-hold scale), its type scaling, its safe-area and
 * IME handling, and Liquid Glass on iOS 26. Each trigger declares both an `sf`
 * (iOS) and an `md` (Android) glyph, so the list stays in one file.
 */
export function TabsShell() {
  const { t: strings } = useI18n();
  const tokens = useTokens();
  const { drawerPresented } = useAppShell();

  return (
    // The bar is a native sibling of the React tree and would float above the
    // drawer, so it steps aside while the drawer is on screen.
    // Material hides unselected labels once a bar has more than three items;
    // naming every tab (as chat apps do) needs `labeled`.
    <NativeTabs tintColor={tokens.accent} labelVisibilityMode="labeled" hidden={drawerPresented}>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" md="chat_bubble" />
        <NativeTabs.Trigger.Label>{strings.tabs.chat}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="experts">
        <NativeTabs.Trigger.Icon sf="person.2" md="group" />
        <NativeTabs.Trigger.Label>{strings.tabs.experts}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="automation">
        <NativeTabs.Trigger.Icon sf="clock" md="schedule" />
        <NativeTabs.Trigger.Label>{strings.tabs.automation}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
        <NativeTabs.Trigger.Label>{strings.tabs.me}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
