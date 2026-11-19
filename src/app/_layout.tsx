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
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppDrawer, type DrawerRoute } from '@/components/AppDrawer';
import { LaunchSplash } from '@/components/LaunchSplash';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/features/auth';
import { LoginScreen } from '@/features/LoginScreen';
import { AppShellProvider, useAppShell } from '@/features/app-shell';
import { registerLastAgentStore } from '@/features/last-agent-store';
import { I18nProvider, useI18n } from '@/i18n/I18nProvider';
import { NATIVE_HEADERS } from '@/platform/screen-header';
import { expoSecureStorage } from '@/platform/secure-store';
import { KeyboardProvider } from '@/platform/keyboard';
import { darkTokens, lightTokens, ThemeProvider, useTheme } from '@/theme';

/** How long the launch screen stays up at minimum. */
const LAUNCH_HOLD_MS = 800;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen may already be hidden during fast refresh or headless rendering.
});
SplashScreen.setOptions({ duration: 400, fade: true });

/** Maps the current path to the drawer row that should read as selected. */
function drawerRouteFor(pathname: string): DrawerRoute | null {
  if (pathname.startsWith('/knowledge')) {
    return 'knowledge';
  }
  if (pathname.startsWith('/usage')) {
    return 'usage';
  }
  if (pathname.startsWith('/settings') || pathname.startsWith('/licenses')) {
    return 'settings';
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
    pinThread,
    deleteThread,
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
  // The launch screen is a brand beat, not just a spinner: hold it briefly so
  // it reads as one instead of flashing between the native splash and the app.
  const [launchSeen, setLaunchSeen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLaunchSeen(true), LAUNCH_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);
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
    return <LaunchSplash />;
  }

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={effectiveDark ? 'light' : 'dark'} />
      {!ready || !launchSeen ? (
        <LaunchSplash />
      ) : !user ? (
        <LoginScreen storage={expoSecureStorage} />
      ) : (
        <>
          <Stack
            screenOptions={{
              headerShown: NATIVE_HEADERS,
              contentStyle: { backgroundColor: tokens.bg },
            }}
          >
            {/* The tab group carries its own stacks; a header here would
                stack a second bar above theirs. */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
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
              onThreadPin={pinThread}
              onThreadDelete={deleteThread}
            />
          ) : null}
        </>
      )}
    </NavThemeProvider>
  );
}

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
