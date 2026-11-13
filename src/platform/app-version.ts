import Constants from 'expo-constants';

/**
 * App marketing / native build version for Settings and diagnostics.
 *
 * Source of truth for the user-facing marketing version is `app.json` →
 * `expo.version` (kept equal to `package.json` `version`). Native build
 * numbers (`CFBundleVersion` / `versionCode`) come from the installed
 * binary — EAS production uses remote auto-increment (`eas.json`).
 */
export interface AppVersionInfo {
  /** Semver marketing version, e.g. `1.0.0`. */
  version: string;
  /** Platform build number when the native binary reports one. */
  build: string | null;
}

/** Reads version metadata from Expo Constants (no Platform.OS branching). */
export function getAppVersion(): AppVersionInfo {
  const fromConfig =
    Constants.expoConfig?.version ??
    (Constants.manifest2 as { extra?: { expoClient?: { version?: string } } } | null)?.extra
      ?.expoClient?.version;
  const version =
    (typeof fromConfig === 'string' && fromConfig.length > 0 ? fromConfig : null) ??
    (typeof Constants.nativeApplicationVersion === 'string' &&
    Constants.nativeApplicationVersion.length > 0
      ? Constants.nativeApplicationVersion
      : null) ??
    '0.0.0';
  const buildRaw = Constants.nativeBuildVersion;
  const build =
    typeof buildRaw === 'string' && buildRaw.length > 0
      ? buildRaw
      : typeof buildRaw === 'number'
        ? String(buildRaw)
        : null;
  return { version, build };
}

/** Compact label for Settings: `1.0.0` or `1.0.0 (42)`. */
export function formatAppVersion(info: AppVersionInfo = getAppVersion()): string {
  return info.build ? `${info.version} (${info.build})` : info.version;
}
