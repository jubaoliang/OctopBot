import * as SecureStore from 'expo-secure-store';

import type { SecureStorage } from './secure-storage';

/**
 * expo-secure-store implementation of the platform SecureStorage
 * interface (Keychain on iOS, Keystore on Android).
 */
export const expoSecureStorage: SecureStorage = {
  get: key => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  delete: key => SecureStore.deleteItemAsync(key),
};
