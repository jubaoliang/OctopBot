import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ScreenHeader, TOP_EDGES } from '@/platform/screen-header';
import { useTabBarFootprint } from '@/platform/tab-bar';
import { AgentAvatar } from '@/components/AgentAvatar';
import { SettingsRow, SettingsSection } from '@/components/Settings';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

/**
 * 我的 — account hub: profile header, change password, entry to Settings,
 * sign-out. App preferences live on the Settings screen (drawer + this
 * Settings row). The profile block carries who is signed in and to which
 * server, so the account rows below never have to repeat it.
 */
export default function MeScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const { baseUrl, user, logout } = useAuth();
  const router = useRouter();
  const tabBarFootprint = useTabBarFootprint();
  const username = user?.username ?? strings.me.notLoggedIn;

  const confirmLogout = () => {
    haptics.notify('warning');
    Alert.alert(strings.me.logoutConfirmTitle, strings.me.logoutConfirmMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: strings.me.logout, style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={TOP_EDGES} style={styles.safe}>
        <ScreenHeader brand largeTitle={strings.me.title} onMenu={openDrawer} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, { paddingBottom: tabBarFootprint }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <View
            accessible
            accessibilityLabel={baseUrl ? `${username}, ${baseUrl}` : username}
            style={[
              styles.profile,
              continuousCorners,
              { backgroundColor: tokens.surface, shadowColor: tokens.shadowSoft },
            ]}
          >
            <AgentAvatar name={username} size={56} fallbackTextSecondary={tokens.textSecondary} />
            <View style={styles.profileText}>
              <Text style={[styles.profileName, { color: tokens.textPrimary }]} numberOfLines={1}>
                {username}
              </Text>
              {baseUrl ? (
                <Text
                  style={[styles.profileServer, { color: tokens.textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {baseUrl}
                </Text>
              ) : null}
            </View>
          </View>

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
    paddingTop: 4,
    gap: 24,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.card,
    padding: 16,
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    ...typeScale.title3,
  },
  profileServer: {
    ...typeScale.footnote,
  },
});
