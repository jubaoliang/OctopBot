import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

import type { DeviceSmsMessage } from '@/core/device-tools';

/**
 * Platform telephony — the ONLY place the OctopTelephony native module is
 * touched (AGENTS.md wrapper hygiene). Android reads/sends SMS and places
 * calls directly; every other target resolves to `supported: false` and the
 * device-tool registry falls back to the OS dialer/composer hand-offs.
 *
 * Permissions are re-checked natively at call time; the consent switch and
 * the in-conversation approval card gate these functions from JS.
 */

export type TelephonyPermissionState = 'granted' | 'denied' | 'undetermined';
export type TelephonyCapability = 'sms' | 'call';

export interface Telephony {
  /** True when direct SMS/call execution exists on this target. */
  supported: boolean;
  getPermissionStatus: (kind: TelephonyCapability) => Promise<TelephonyPermissionState>;
  requestPermissions: (kind: TelephonyCapability) => Promise<TelephonyPermissionState>;
  readSms: (input: { query?: string; limit?: number }) => Promise<DeviceSmsMessage[]>;
  sendSms: (input: { number: string; body: string }) => Promise<{ status: 'sent' }>;
  call: (input: { number: string }) => Promise<{ status: 'placed' }>;
}

interface NativeSmsRow {
  id: string;
  address: string;
  body: string;
  date: number;
  type: 'inbox' | 'sent';
}

interface TelephonyNativeModule {
  getPermissionsAsync: (kind: TelephonyCapability) => Promise<{
    granted?: boolean;
    status?: string;
  }>;
  requestPermissionsAsync: (kind: TelephonyCapability) => Promise<{
    granted?: boolean;
    status?: string;
  }>;
  readSms: (query: string | null, limit: number) => Promise<NativeSmsRow[]>;
  sendSms: (number: string, body: string) => Promise<{ status: string }>;
  call: (number: string) => Promise<{ status: string }>;
}

const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<TelephonyNativeModule>('OctopTelephony')
    : null;

function toState(response: { granted?: boolean; status?: string }): TelephonyPermissionState {
  if (response.granted) {
    return 'granted';
  }
  if (response.status === 'denied') {
    return 'denied';
  }
  return 'undetermined';
}

function requireNative(): TelephonyNativeModule {
  if (!native) {
    throw new Error('telephony unsupported on this platform');
  }
  return native;
}

const noopTelephony: Telephony = {
  supported: false,
  getPermissionStatus: async () => 'denied',
  requestPermissions: async () => 'denied',
  readSms: async () => {
    throw new Error('telephony unsupported on this platform');
  },
  sendSms: async () => {
    throw new Error('telephony unsupported on this platform');
  },
  call: async () => {
    throw new Error('telephony unsupported on this platform');
  },
};

const nativeTelephony: Telephony = {
  supported: true,
  getPermissionStatus: kind => requireNative().getPermissionsAsync(kind).then(toState),
  requestPermissions: kind => requireNative().requestPermissionsAsync(kind).then(toState),
  readSms: async ({ query, limit }) => {
    const rows = await requireNative().readSms(query ?? null, limit ?? 20);
    return rows.map(row => ({
      id: row.id,
      address: row.address,
      body: row.body,
      date: row.date,
      type: row.type === 'sent' ? 'sent' : 'inbox',
    }));
  },
  sendSms: async ({ number, body }) => {
    await requireNative().sendSms(number, body);
    return { status: 'sent' };
  },
  call: async ({ number }) => {
    await requireNative().call(number);
    return { status: 'placed' };
  },
};

export const telephony: Telephony = native ? nativeTelephony : noopTelephony;
