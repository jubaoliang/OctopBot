import { Stack } from 'expo-router';

import { NATIVE_HEADERS } from '@/platform/screen-header';

/** Chat tab = own stack: home (index) → thread view. Tab bar stays visible. */
export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: NATIVE_HEADERS,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
