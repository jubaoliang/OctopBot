import { NativeTabs } from 'expo-router/native-tabs';

import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTokens } from '@/theme';

/**
 * iOS tab shell: the system tab bar (`UITabBar` through react-native-screens).
 *
 * A native bar is not a styled copy of the system one — it *is* the system
 * one, so it carries Liquid Glass on iOS 26+, the platform's selection and
 * minimising behaviour, Dynamic Type, VoiceOver order and the correct safe
 * area by construction. The custom bar in `DesignTabBar` remains the Android
 * implementation and is not rendered here.
 *
 * Consequence worth knowing: the bar is part of the window chrome, so it does
 * not hide while the composer's keyboard is up (iOS keeps it in place) and the
 * drawer draws over it instead of waiting for it to disappear.
 */
export function TabsShell() {
  const { t: strings } = useI18n();
  const tokens = useTokens();
  const { drawerPresented } = useAppShell();

  return (
    // The system bar is a native sibling of the React tree, so it would keep
    // floating above the drawer; hide it while the drawer is on screen.
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
