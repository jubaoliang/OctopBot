import { Redirect, Stack } from 'expo-router';

/** Root entry: send '/' to the tabs group (chat tab is the home screen). */
export default function RootIndex() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Redirect href="/(tabs)/chat" />
    </>
  );
}
