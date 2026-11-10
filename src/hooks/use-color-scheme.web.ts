import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

function subscribe(callback: () => void) {
  const subscription = Appearance.addChangeListener(callback);
  return () => subscription.remove();
}

/**
 * To support static rendering, the server snapshot stays 'light' while the
 * client-side store reports the real scheme once hydrated.
 */
export function useColorScheme() {
  return useSyncExternalStore(
    subscribe,
    () => Appearance.getColorScheme(),
    () => 'light',
  );
}
