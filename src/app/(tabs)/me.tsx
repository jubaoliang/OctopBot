import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useI18n, localeNames, type Locale } from '@/i18n/I18nProvider';
import { palettes, useTheme, useTokens } from '@/theme';
import type { UserThemeMode } from '@/theme/ThemeProvider';

/**
 * 我的 — appearance (theme mode incl. system-follow, accent palette),
 * language, current server, and sign-out. All rows use the design's
 * token system; nothing is hardcoded.
 */
export default function MeScreen() {
  const tokens = useTokens();
  const { mode, setMode, paletteId, setPaletteId } = useTheme();
  const { locale, setLocale } = useI18n();
  const { openDrawer } = useAppShell();
  const { baseUrl, logout } = useAuth();
  const { t: strings } = useI18n();

  const tabBarFootprint = useTabBarFootprint();

  const themeModes: { id: UserThemeMode; label: string }[] = [
    { id: 'light', label: strings.me.modeLight },
    { id: 'dark', label: strings.me.modeDark },
    { id: 'system', label: strings.me.modeSystem },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={[styles.safe, { paddingBottom: tabBarFootprint }]}>
        <AppHeader onMenu={openDrawer} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.section, { color: tokens.textTertiary }]}>
            {strings.me.appearance}
          </Text>

          <View style={styles.modeRow}>
            {themeModes.map(({ id, label }) => {
              const active = mode === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.modeButton,
                    { backgroundColor: active ? tokens.overlaySubtle : 'transparent' },
                    pressed && !active ? { opacity: 0.6 } : null,
                  ]}
                  onPress={() => setMode(id)}
                >
                  <Text style={[styles.modeLabel, { color: tokens.textBody }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.section, { color: tokens.textTertiary }]}>{strings.me.palette}</Text>
          <View style={styles.paletteWrap}>
            {palettes.map(p => (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: paletteId === p.id }}
                style={[
                  styles.paletteDot,
                  { backgroundColor: p.accent.light },
                  paletteId === p.id ? { borderColor: tokens.textBody, borderWidth: 2 } : null,
                ]}
                onPress={() => setPaletteId(p.id)}
              />
            ))}
          </View>

          <Text style={[styles.section, { color: tokens.textTertiary }]}>Language</Text>
          <View style={styles.modeRow}>
            {(Object.keys(localeNames) as Locale[]).map(l => (
              <Pressable
                key={l}
                style={({ pressed }) => [
                  styles.modeButton,
                  { backgroundColor: locale === l ? tokens.overlaySubtle : 'transparent' },
                  pressed && locale !== l ? { opacity: 0.6 } : null,
                ]}
                onPress={() => setLocale(l)}
              >
                <Text style={[styles.modeLabel, { color: tokens.textBody }]}>{localeNames[l]}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.logoutButton,
              { backgroundColor: tokens.surface, opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={() => void logout()}
          >
            <Text style={[styles.logoutText, { color: tokens.danger }]}>{strings.me.logout}</Text>
          </Pressable>

          {/* Secondary footer — deliberately quiet, like legal links. */}
          <Text
            style={[styles.serverFootnote, { color: tokens.textTertiary }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {strings.me.connectedTo.replace('{url}', baseUrl ?? '—')}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    padding: 16,
    gap: 12,
  },
  section: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeLabel: {
    fontSize: 16,
    lineHeight: 24,
  },
  paletteWrap: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  paletteDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  serverFootnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 20,
  },
  logoutButton: {
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
});
