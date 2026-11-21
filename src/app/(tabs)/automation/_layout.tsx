import { Stack } from 'expo-router';

import { NATIVE_HEADERS } from '@/platform/screen-header';
import { useStackAnimation } from '@/theme';

/**
 * Root of the automation tab. It is its own stack so the screen can wear the
 * system navigation bar on iOS (a large title needs a navigation stack) while
 * Android keeps drawing the bar inside the screen.
 */
export default function AutomationLayout() {
  const stackAnimation = useStackAnimation();
  return (
    <Stack
      screenOptions={{
        headerShown: NATIVE_HEADERS,
        ...stackAnimation,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
