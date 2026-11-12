import { SpaceMono_400Regular, useFonts } from '@expo-google-fonts/space-mono';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavThemeProvider,
  usePathname,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppDrawer, type DrawerRoute } from '@/components/AppDrawer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { registerLastAgentStore } from '@/app/(tabs)/chat/index';
import { AuthProvider, useAuth } from '@/features/auth';
import { LoginScreen } from '@/features/LoginScreen';
import { AppShellProvider, useAppShell } from '@/features/app-shell';
import { I18nProvider, useI18n } from '@/i18n/I18nProvider';
import { expoSecureStorage } from '@/platform/secure-store';
import { KeyboardProvider } from '@/platform/keyboard';
import { darkTokens, lightTokens, ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen may already be hidden during fast refresh or headless rendering.
});

/** Maps the current path to the drawer row that should read as selected. */
function drawerRouteFor(pathname: string): DrawerRoute | null {
  if (pathname.startsWith('/experts')) {
    return 'experts';
  }
  if (pathname.startsWith('/automation')) {
    return 'automation';
  }
  if (pathname.startsWith('/usage')) {
    return 'usage';
  }
  if (pathname === '/' || pathname.startsWith('/chat')) {
    return 'chat';
  }
  return null;
}

function RootNavigator() {
  const { resolvedMode, tokens } = useTheme();
  const {
    drawerOpen,
    drawerPresented,
    closeDrawer,
    finishDrawerClose,
    drawerGroups,
    navigate,
    loadGroupThreads,
    openThread,
  } = useAppShell();
  const { ready, user } = useAuth();
  const pathname = usePathname();

  // The theme provider already resolves `system` against the OS scheme; an
  // explicit Light/Dark choice must win over the OS setting here too.
  const effectiveDark = resolvedMode === 'dark';

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

  const [fontsLoaded, fontError] = useFonts({ SpaceMono_400Regular });
  // A missing font asset must not trap the app behind the splash/gate —
  // fall through and let code fences use the platform monospace face.
  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (!fontsReady) {
      return;
    }
    void SplashScreen.hideAsync().catch(() => {
      // Already hidden.
    });
  }, [fontsReady]);

  if (!fontsReady) {
    return (
      <View style={[styles.gate, { backgroundColor: tokens.bg }]}>
        <ActivityIndicator color={tokens.accent} />
      </View>
    );
  }

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={effectiveDark ? 'light' : 'dark'} />
      {!ready ? (
        <View style={[styles.gate, { backgroundColor: tokens.bg }]}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : !user ? (
        <LoginScreen storage={expoSecureStorage} />
      ) : (
        <>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg } }}
          />
          {drawerPresented ? (
            <AppDrawer
              visible={drawerOpen}
              onClose={closeDrawer}
              onDismissed={finishDrawerClose}
              activeRoute={drawerRouteFor(pathname)}
              onNavigate={navigate}
              groups={drawerGroups}
              onGroupPress={loadGroupThreads}
              onThreadPress={openThread}
            />
          ) : null}
        </>
      )}
    </NavThemeProvider>
  );
}

const styles = {
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
} as const;

function RootWithBoundary() {
  const { t: strings } = useI18n();
  const { tokens } = useTheme();
  return (
    <ErrorBoundary
      title={strings.chat.crashTitle}
      hint={strings.chat.crashHint}
      retryLabel={strings.chat.crashRetry}
      colors={{
        bg: tokens.bg,
        textPrimary: tokens.textPrimary,
        textSecondary: tokens.textSecondary,
        overlaySubtle: tokens.overlaySubtle,
      }}
    >
      <AuthProvider storage={expoSecureStorage}>
        <AppShellProvider>
          <RootNavigator />
        </AppShellProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  // One-time registration: the chat home persists the last-used expert id
  // through the same secure storage the rest of the session state uses.
  registerLastAgentStore(
    () => expoSecureStorage.get('chat.lastAgentId'),
    id => expoSecureStorage.set('chat.lastAgentId', id),
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeProvider storage={expoSecureStorage}>
          <I18nProvider storage={expoSecureStorage}>
            <RootWithBoundary />
          </I18nProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
