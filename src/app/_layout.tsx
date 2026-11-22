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
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';

import { AppDrawer, type DrawerRoute } from '@/components/AppDrawer';
import { LaunchSplash } from '@/components/LaunchSplash';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/features/auth';
import { LoginScreen } from '@/features/LoginScreen';
import { AppShellProvider, useAppShell } from '@/features/app-shell';
import { CalendarSyncProvider } from '@/features/calendar-sync';
import { NotificationsProvider } from '@/features/notifications';
import { registerLastAgentStore } from '@/features/last-agent-store';
import { I18nProvider, useI18n } from '@/i18n/I18nProvider';
import { NATIVE_HEADERS } from '@/platform/screen-header';
import { expoSecureStorage } from '@/platform/secure-store';
import { KeyboardProvider } from '@/platform/keyboard';
import {
  darkTokens,
  lightTokens,
  ThemeProvider,
  useTheme,
  useBranchFade,
  useStackAnimation,
} from '@/theme';

/** How long the launch screen stays up at minimum. */
const LAUNCH_HOLD_MS = 800;

/**
 * Branch wrapper: fills the themed background view so the swap fades below
 * animate over that background, never over the raw window.
 */
const APP_ROOT_STYLE = { flex: 1 } as const;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen may already be hidden during fast refresh or headless rendering.
});
SplashScreen.setOptions({ duration: 400, fade: true });

// Suspends re-renders of blurred screens (inactive tabs, covered stack
// screens) so background React work cannot jank the visible transition.
// This also makes freezeOnBlur default to true for every navigator: a
// streaming chat thread keeps its socket alive while blurred, and its
// queued updates replay in one commit on focus. No-op on web.
enableFreeze(true);

/** Maps the current path to the drawer row that should read as selected. */
function drawerRouteFor(pathname: string): DrawerRoute | null {
  if (pathname.startsWith('/today')) {
    return 'today';
  }
  if (pathname.startsWith('/knowledge')) {
    return 'knowledge';
  }
  if (pathname.startsWith('/usage')) {
    return 'usage';
  }
  if (pathname.startsWith('/connect')) {
    return 'connect';
  }
  if (pathname.startsWith('/settings') || pathname.startsWith('/licenses')) {
    return 'settings';
  }
  return null;
}

function RootNavigator() {
  const { resolvedMode, tokens } = useTheme();
  // Reduce Motion swaps the platform push for a fade (HIG: fewer/gentler).
  const stackAnimation = useStackAnimation();
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
  // Top-level swaps (splash → login, splash → app, login → app) share one
  // fade pair with the splash exit so the handover reads as one surface.
  const { entering: branchEntering, exiting: branchExiting } = useBranchFade();

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

  // Stable across the pathname/drawer re-renders RootNavigator sees.
  const rootStyle = useMemo(() => [APP_ROOT_STYLE, { backgroundColor: tokens.bg }], [tokens.bg]);

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
      <View style={rootStyle}>
        {!ready || !launchSeen ? (
          <LaunchSplash />
        ) : !user ? (
          // Distinct keys force a real unmount/mount on branch swaps — the
          // same Animated.View type at one position would be updated in
          // place, and layout animations only fire on mount/unmount.
          <Animated.View
            key="login"
            entering={branchEntering}
            exiting={branchExiting}
            style={APP_ROOT_STYLE}
          >
            <LoginScreen storage={expoSecureStorage} />
          </Animated.View>
        ) : (
          // No exiting here on purpose: this wrapper owns the native stack
          // and the drawer, and fading a navigator subtree out while auth
          // tears down invites native-view teardown artifacts. Logout is
          // rare; the incoming login fade carries the swap.
          <Animated.View key="app" entering={branchEntering} style={APP_ROOT_STYLE}>
            <Stack
              screenOptions={{
                headerShown: NATIVE_HEADERS,
                ...stackAnimation,
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
          </Animated.View>
        )}
      </View>
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
          <NotificationsProvider storage={expoSecureStorage}>
            <CalendarSyncProvider storage={expoSecureStorage}>
              <RootNavigator />
            </CalendarSyncProvider>
          </NotificationsProvider>
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
