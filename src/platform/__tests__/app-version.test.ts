import Constants from 'expo-constants';

import { formatAppVersion, getAppVersion } from '../app-version';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.2.3' },
    nativeApplicationVersion: '9.9.9',
    nativeBuildVersion: '42',
  },
}));

const mocked = Constants as unknown as {
  expoConfig: { version?: string } | null;
  nativeApplicationVersion: string | null;
  nativeBuildVersion: string | number | null;
};

describe('getAppVersion', () => {
  it('prefers expoConfig.version and reports the native build', () => {
    mocked.expoConfig = { version: '1.2.3' };
    mocked.nativeBuildVersion = '42';
    expect(getAppVersion()).toEqual({ version: '1.2.3', build: '42' });
    expect(formatAppVersion()).toBe('1.2.3 (42)');
  });

  it('falls back to nativeApplicationVersion', () => {
    mocked.expoConfig = null;
    mocked.nativeApplicationVersion = '2.0.0';
    mocked.nativeBuildVersion = null;
    expect(getAppVersion()).toEqual({ version: '2.0.0', build: null });
    expect(formatAppVersion(getAppVersion())).toBe('2.0.0');
  });
});
