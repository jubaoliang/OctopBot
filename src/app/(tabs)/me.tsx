import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SettingsRow, SettingsSection } from '@/components/Settings';
import { VoiceApi } from '@/core/api/voice';
import type { ActiveVoice, VoiceProvider } from '@/core/api/types';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useI18n, localeNames, type Locale } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { layout, palettes, useTheme, useTokens } from '@/theme';
import type { UserThemeMode } from '@/theme/ThemeProvider';

const LOCALES = Object.keys(localeNames) as Locale[];
const BROWSER_STT = 'browser';

/** Swatch diameter; the selection ring is drawn outside it, not into it. */
const SWATCH = 28;
const SWATCH_RING = 40;

function supportsStt(provider: VoiceProvider): boolean {
  return provider.enabled && (provider.capability === 'stt' || provider.capability === 'both');
}

/**
 * 我的 — appearance (theme mode incl. system-follow, accent palette),
 * language, optional speech-input chooser (when cloud STT providers exist),
 * account and sign-out, in the iOS inset-grouped settings anatomy.
 */
export default function MeScreen() {
  const tokens = useTokens();
  const { mode, setMode, resolvedMode, paletteId, setPaletteId } = useTheme();
  const { locale, setLocale, t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const { baseUrl, user, logout, httpClient } = useAuth();
  const tabBarFootprint = useTabBarFootprint();

  const [voiceProviders, setVoiceProviders] = useState<VoiceProvider[]>([]);
  const [activeVoice, setActiveVoice] = useState<ActiveVoice>({
    stt: BROWSER_STT,
    tts: BROWSER_STT,
  });
  const canEditVoice = Boolean(user?.permissions?.includes('voice'));

  const refreshVoice = useCallback(
    async (isCancelled?: () => boolean) => {
      const api = new VoiceApi(httpClient);
      try {
        const [providers, active] = await Promise.all([api.listProviders(), api.getActive()]);
        if (isCancelled?.()) {
          return;
        }
        setVoiceProviders(providers);
        setActiveVoice(active);
      } catch {
        if (isCancelled?.()) {
          return;
        }
        // Voice endpoints may be older / unreachable — hide the section.
        setVoiceProviders([]);
      }
    },
    [httpClient],
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await refreshVoice(() => cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshVoice]);

  const cloudStt = useMemo(
    () =>
      voiceProviders.filter(
        p => supportsStt(p) && p.kind !== BROWSER_STT && p.name !== BROWSER_STT,
      ),
    [voiceProviders],
  );

  const setActiveStt = async (name: string) => {
    if (!canEditVoice || name === (activeVoice.stt || BROWSER_STT)) {
      return;
    }
    haptics.selection();
    try {
      const next = await new VoiceApi(httpClient).setActive({ stt: name });
      setActiveVoice(next);
    } catch {
      Alert.alert(strings.voice.errorTitle, strings.voice.activeUpdateFailed);
    }
  };

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
          showsHorizontalScrollIndicator={false}
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

          {cloudStt.length > 0 ? (
            <SettingsSection title={strings.me.voiceInput} footer={strings.me.voiceFooter}>
              <SettingsRow
                title={strings.me.voiceSystem}
                selected={(activeVoice.stt || BROWSER_STT) === BROWSER_STT}
                testID="stt-browser"
                onPress={canEditVoice ? () => void setActiveStt(BROWSER_STT) : undefined}
              />
              {cloudStt.map((provider, index) => (
                <SettingsRow
                  key={provider.id}
                  title={provider.note?.trim() || provider.name}
                  selected={activeVoice.stt === provider.name}
                  last={index === cloudStt.length - 1}
                  testID={`stt-${provider.name}`}
                  onPress={canEditVoice ? () => void setActiveStt(provider.name) : undefined}
                />
              ))}
            </SettingsSection>
          ) : null}

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
