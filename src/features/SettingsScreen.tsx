import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SettingsRow, SettingsSection } from '@/components/Settings';
import { VoiceApi } from '@/core/api/voice';
import type { ActiveVoice, VoiceProvider } from '@/core/api/types';
import { useAuth } from '@/features/auth';
import { useI18n, localeNames, type Locale, type UserLocaleMode } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { layout, palettes, useTheme, useTokens } from '@/theme';
import type { UserThemeMode } from '@/theme/ThemeProvider';

const LOCALES = Object.keys(localeNames) as Locale[];
const BROWSER_STT = 'browser';
const SWATCH = 28;
const SWATCH_RING = 40;

function supportsStt(provider: VoiceProvider): boolean {
  return provider.enabled && (provider.capability === 'stt' || provider.capability === 'both');
}

/**
 * App preferences — appearance, language, optional STT chooser, licences.
 * Opened from the drawer or 我的; not a tab.
 */
export function SettingsScreen() {
  const tokens = useTokens();
  const { mode, setMode, resolvedMode, paletteId, setPaletteId } = useTheme();
  const { locale, localeMode, setLocaleMode, t: strings } = useI18n();
  const { user, httpClient } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
    { id: 'system', label: strings.settings.modeSystem },
    { id: 'light', label: strings.settings.modeLight },
    { id: 'dark', label: strings.settings.modeDark },
  ];

  const languageModes: { id: UserLocaleMode; label: string; value?: string }[] = [
    {
      id: 'system',
      label: strings.settings.languageSystem,
      value: localeMode === 'system' ? localeNames[locale] : undefined,
    },
    ...LOCALES.map(id => ({ id, label: localeNames[id] })),
  ];

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/chat');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title={strings.settings.title} onBack={goBack} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <SettingsSection title={strings.settings.appearance}>
            <View style={styles.controlRow}>
              <SegmentedControl
                options={themeModes}
                value={mode}
                onChange={setMode}
                accessibilityLabel={strings.settings.appearance}
              />
            </View>
          </SettingsSection>

          <SettingsSection title={strings.settings.palette}>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={strings.settings.palette}
              style={styles.swatchRow}
            >
              {palettes.map(p => {
                const active = paletteId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={strings.settings.paletteNames[p.id] ?? p.name}
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

          <SettingsSection title={strings.settings.language}>
            {languageModes.map((option, index) => (
              <SettingsRow
                key={option.id}
                title={option.label}
                value={option.value}
                selected={localeMode === option.id}
                last={index === languageModes.length - 1}
                testID={`locale-${option.id}`}
                onPress={() => {
                  if (localeMode !== option.id) {
                    haptics.selection();
                    setLocaleMode(option.id);
                  }
                }}
              />
            ))}
          </SettingsSection>

          {cloudStt.length > 0 ? (
            <SettingsSection
              title={strings.settings.voiceInput}
              footer={strings.settings.voiceFooter}
            >
              <SettingsRow
                title={strings.settings.voiceSystem}
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

          <SettingsSection>
            <SettingsRow
              title={strings.settings.licenses}
              disclosure
              last
              testID="settings-licenses"
              onPress={() => router.push('/licenses')}
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
    borderWidth: StyleSheet.hairlineWidth,
  },
});
