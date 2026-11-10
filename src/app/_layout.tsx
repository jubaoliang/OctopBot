import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';

import { AppDrawer } from '@/components/AppDrawer';
import { AppShellProvider, useAppShell } from '@/features/app-shell';
import { I18nProvider } from '@/i18n/I18nProvider';
import { expoSecureStorage } from '@/platform/secure-store';
import { darkTokens, lightTokens, ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen may already be hidden during fast refresh or headless rendering.
});

function RootNavigator() {
  const { mode, tokens } = useTheme();
  const scheme = useColorScheme();
  const { drawerOpen, closeDrawer, drawerGroups, userName, navigate } = useAppShell();

  // 'dark' is an explicit override; otherwise follow the OS scheme.
  const effectiveDark = mode === 'dark' || scheme === 'dark';

  // Navigation chrome follows the app tokens so overscroll/transition
  // areas never flash a foreign shade.
  const navTheme = useMemo(() => {
    const base = effectiveDark ? DarkTheme : DefaultTheme;
    const palette = effectiveDark ? darkTokens : lightTokens;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: palette.bg,
        card: palette.bg,
        text: palette.textPrimary,
      },
    };
  }, [effectiveDark]);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {
      // Already hidden.
    });
  }, []);

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={effectiveDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg } }} />
      {drawerOpen ? (
        <AppDrawer
          visible={drawerOpen}
          onClose={closeDrawer}
          onNavigate={navigate}
          groups={drawerGroups}
          userName={userName}
        />
      ) : null}
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider storage={expoSecureStorage}>
        <I18nProvider storage={expoSecureStorage}>
          <AppShellProvider>
            <RootNavigator />
          </AppShellProvider>
        </I18nProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
