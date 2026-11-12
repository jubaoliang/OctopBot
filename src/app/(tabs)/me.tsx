import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SettingsRow, SettingsSection } from '@/components/Settings';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useI18n, localeNames, type Locale } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { layout, palettes, useTheme, useTokens } from '@/theme';
import type { UserThemeMode } from '@/theme/ThemeProvider';

const LOCALES = Object.keys(localeNames) as Locale[];

/** Swatch diameter; the selection ring is drawn outside it, not into it. */
const SWATCH = 28;
const SWATCH_RING = 40;

/**
 * 我的 — appearance (theme mode incl. system-follow, accent palette),
 * language, account and sign-out, in the iOS inset-grouped settings
 * anatomy. All rows use the design's token system; nothing is hardcoded.
 */
export default function MeScreen() {
  const tokens = useTokens();
  const { mode, setMode, resolvedMode, paletteId, setPaletteId } = useTheme();
  const { locale, setLocale, t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const { baseUrl, user, logout } = useAuth();
  const tabBarFootprint = useTabBarFootprint();

  const themeModes: { id: UserThemeMode; label: string }[] = [
    { id: 'light', label: strings.me.modeLight },
    { id: 'dark', label: strings.me.modeDark },
    { id: 'system', label: strings.me.modeSystem },
  ];

  const confirmLogout = () => {
    // Destructive and not undoable from here: confirm first (HIG "Alerts").
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
        >
          <SettingsSection title={strings.me.appearance}>
            <View style={styles.controlRow}>
              <SegmentedControl
                options={themeModes}
                value={mode}
                onChange={setMode}
                accessibilityLabel={strings.me.appearance}
              />
            </View>
          </SettingsSection>

          <SettingsSection title={strings.me.palette}>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={strings.me.palette}
              style={styles.swatchRow}
            >
              {palettes.map(p => {
                const active = paletteId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={strings.me.paletteNames[p.id] ?? p.name}
                    testID={`palette-${p.id}`}
                    hitSlop={(layout.hitTarget - SWATCH_RING) / 2}
                    style={({ pressed }) => [
                      styles.swatchRing,
                      { borderColor: active ? tokens.textBody : 'transparent' },
                      pressed ? styles.swatchPressed : null,
                    ]}
                    onPress={() => {
                      if (!active) {
                        haptics.selection();
                        setPaletteId(p.id);
                      }
                    }}
                  >
                    <View
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: p.accent[resolvedMode],
                          borderColor: tokens.borderStrong,
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          </SettingsSection>

          <SettingsSection title={strings.me.language}>
            {LOCALES.map((l, index) => (
              <SettingsRow
                key={l}
                title={localeNames[l]}
                selected={locale === l}
                last={index === LOCALES.length - 1}
                testID={`locale-${l}`}
                onPress={() => {
                  if (locale !== l) {
                    haptics.selection();
                    setLocale(l);
                  }
                }}
              />
            ))}
          </SettingsSection>

          <SettingsSection title={strings.me.account}>
            <SettingsRow
              title={strings.login.username}
              value={user?.username ?? strings.me.notLoggedIn}
            />
            <SettingsRow title={strings.me.server} value={baseUrl ?? '—'} last />
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
  controlRow: {
    padding: 12,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  swatchRing: {
    width: SWATCH_RING,
    height: SWATCH_RING,
    borderRadius: SWATCH_RING / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchPressed: {
    opacity: 0.6,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    // Hairline keeps the ink swatch visible on a dark surface and vice versa.
    borderWidth: StyleSheet.hairlineWidth,
  },
});
