import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { SettingsRow, SettingsSection } from '@/components/Settings';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { layout, useTokens } from '@/theme';

/**
 * 我的 — account hub: profile, change password, entry to Settings, sign-out.
 * App preferences live on the Settings screen (drawer + this Settings row).
 */
export default function MeScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const { baseUrl, user, logout } = useAuth();
  const router = useRouter();
  const tabBarFootprint = useTabBarFootprint();

  const confirmLogout = () => {
    haptics.notify('warning');
    Alert.alert(strings.me.logoutConfirmTitle, strings.me.logoutConfirmMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: strings.me.logout, style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader onMenu={openDrawer} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarFootprint }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <SettingsSection title={strings.me.account}>
            <SettingsRow
              title={strings.login.username}
              value={user?.username ?? strings.me.notLoggedIn}
            />
            <SettingsRow title={strings.me.server} value={baseUrl ?? '—'} last />
          </SettingsSection>

          <SettingsSection>
            <SettingsRow
              title={strings.me.changePassword}
              disclosure
              testID="me-change-password"
              onPress={() => router.push('/change-password')}
            />
            <SettingsRow
              title={strings.me.settings}
              disclosure
              last
              testID="me-settings"
              onPress={() => router.push('/settings')}
            />
          </SettingsSection>

          <SettingsSection>
            <SettingsRow
              title={strings.me.logout}
              destructive
              last
              testID="logout"
              onPress={confirmLogout}
            />
          </SettingsSection>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 8,
    gap: 24,
  },
});
