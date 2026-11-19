import { NativeTabs } from 'expo-router/native-tabs';

import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTokens } from '@/theme';

/**
 * iOS tab bar: the system `UITabBar` through react-native-screens, so Liquid
 * Glass on iOS 26+, the standard selection treatment, Dynamic Type and the
 * safe area all come from the platform.
 *
 * Android takes `tabs-shell.tsx` instead — its bar is drawn there, in the
 * shape chat apps on that platform use.
 */
export function TabsShell() {
  const { t: strings } = useI18n();
  const tokens = useTokens();
  const { drawerPresented } = useAppShell();

  return (
    // The bar is a native sibling of the React tree and would float above the
    // drawer, so it steps aside while the drawer is on screen.
    <NativeTabs tintColor={tokens.accent} hidden={drawerPresented}>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" />
        <NativeTabs.Trigger.Label>{strings.tabs.chat}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="experts">
        <NativeTabs.Trigger.Icon sf="person.2" />
        <NativeTabs.Trigger.Label>{strings.tabs.experts}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="automation">
        <NativeTabs.Trigger.Icon sf="clock" />
        <NativeTabs.Trigger.Label>{strings.tabs.automation}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf="person.crop.circle" />
        <NativeTabs.Trigger.Label>{strings.tabs.me}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
