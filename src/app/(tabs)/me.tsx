import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { useAppShell } from '@/features/app-shell';
import { useI18n, localeNames, type Locale } from '@/i18n/I18nProvider';
import { palettes, useTheme } from '@/theme';
import type { ThemeMode } from '@/theme';

/**
 * 我的 tab — appearance controls (mode + accent palette + locale), using
 * the design's row language. Functional requirement: dark mode + palettes.
 */
export default function MeScreen() {
  const { tokens } = useTheme();
  const { mode, setMode, paletteId, setPaletteId } = useTheme();
  const { locale, setLocale } = useI18n();
  const { openDrawer } = useAppShell();
  const { t: strings } = useI18n();

  const tabBarFootprint = useTabBarFootprint();
  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={[styles.safe, { paddingBottom: tabBarFootprint }]}>
        <AppHeader onMenu={openDrawer} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.section, { color: tokens.textTertiary }]}>
            {strings.me.appearance}
          </Text>

          <View style={styles.modeRow}>
            {(['light', 'dark'] as ThemeMode[]).map(m => (
              <Pressable
                key={m}
                style={[
                  styles.modeButton,
                  { backgroundColor: mode === m ? tokens.overlaySubtle : 'transparent' },
                ]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeLabel, { color: tokens.textBody }]}>
                  {m === 'light' ? strings.me.modeLight : strings.me.modeDark}
                </Text>
              </Pressable>
            ))}
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
                style={[
                  styles.modeButton,
                  { backgroundColor: locale === l ? tokens.overlaySubtle : 'transparent' },
                ]}
                onPress={() => setLocale(l)}
              >
                <Text style={[styles.modeLabel, { color: tokens.textBody }]}>{localeNames[l]}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingTop: 47 },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
});
