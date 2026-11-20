import { Stack } from 'expo-router';

import { NATIVE_HEADERS } from '@/platform/screen-header';
import { useStackAnimation } from '@/theme';

/** Chat tab = own stack: home (index) → thread view. Tab bar stays visible. */
export default function ChatLayout() {
  // Reduce Motion swaps the platform push for a fade; the shared helper
  // also pairs it with the back-gesture option (see its doc).
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
