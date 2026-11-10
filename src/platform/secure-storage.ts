/**
 * Platform capability interfaces.
 *
 * The app never imports an `expo-*` or native package outside this directory.
 * Each interface documents what the HarmonyOS shim must eventually provide
 * (see AGENTS.md → Platform strategy).
 */

/**
 * Key-value storage for secrets (tokens, server URL). Implementations must
 * persist encrypted on device — Keychain on iOS, Keystore on Android.
 * HarmonyOS shim: asset-store or encrypted preferences.
 */
export interface SecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export const StorageKeys = {
  baseUrl: 'octop.baseUrl',
  accessToken: 'octop.accessToken',
  localeOverride: 'octop.locale',
} as const;
