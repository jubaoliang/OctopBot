import { Redirect } from 'expo-router';

/**
 * Landing route for the dev-only session seed deep link
 * (octopbot://dev-session?…) — auth seeding happens in AuthProvider;
 * this route only absorbs the navigation and lands on the tabs.
 */
export default function DevSessionScreen() {
  return <Redirect href="/(tabs)/chat" />;
}
