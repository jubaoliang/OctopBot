import { Stack } from 'expo-router';

/** Chat tab = own stack: home (index) → thread view. Tab bar stays visible. */
export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
    />
  );
}
