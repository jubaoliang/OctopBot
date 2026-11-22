import { Redirect } from 'expo-router';

/**
 * Unknown links — a bad `octopbot://` path, or a route removed between versions —
 * land on the chat home instead of a dead end: the app is opened from outside,
 * so "go back" has nowhere to go.
 */
export default function NotFound() {
  return <Redirect href="/(tabs)/chat" />;
}
