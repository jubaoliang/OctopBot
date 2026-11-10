import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Colors } from '@/constants/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen may already be hidden during fast refresh or headless rendering.
});

function navigationTheme(scheme: string | null) {
  const dark = scheme === 'dark';
  const base = dark ? DarkTheme : DefaultTheme;
  const palette = dark ? Colors.dark : Colors.light;
  // Keep navigation chrome in sync with the app palette so transition gaps and
  // overscroll areas don't flash a different shade.
  return {
    ...base,
    colors: { ...base.colors, background: palette.background, card: palette.background },
  };
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={navigationTheme(colorScheme)}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
