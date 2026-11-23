import { requireOptionalNativeModule } from 'expo-modules-core';

import { telephony } from '../telephony';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: jest.fn(() => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    readSms: jest.fn(),
    sendSms: jest.fn(),
    call: jest.fn(),
  })),
}));

interface NativeShape {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  readSms: jest.Mock;
  sendSms: jest.Mock;
  call: jest.Mock;
}

// The wrapper captured this instance at import time.
const native = (requireOptionalNativeModule as jest.Mock).mock.results[0].value as NativeShape;

describe('telephony (Android, module linked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports direct support', () => {
    expect(telephony.supported).toBe(true);
  });

  it('maps permission responses per capability', async () => {
    native.getPermissionsAsync.mockResolvedValue({ granted: true });
    await expect(telephony.getPermissionStatus('sms')).resolves.toBe('granted');
    expect(native.getPermissionsAsync).toHaveBeenCalledWith('sms');
    native.requestPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied' });
    await expect(telephony.requestPermissions('call')).resolves.toBe('denied');
    expect(native.requestPermissionsAsync).toHaveBeenCalledWith('call');
    native.getPermissionsAsync.mockResolvedValue({ granted: false });
    await expect(telephony.getPermissionStatus('sms')).resolves.toBe('undetermined');
  });

  it('reads SMS with a null query and the default limit', async () => {
    native.readSms.mockResolvedValue([
      { id: '1', address: '10086', body: 'balance', date: 1700000000000, type: 'inbox' },
      { id: '2', address: '10086', body: 'sent reply', date: 1700000001000, type: 'sent' },
    ]);
    await expect(telephony.readSms({})).resolves.toEqual([
      { id: '1', address: '10086', body: 'balance', date: 1700000000000, type: 'inbox' },
      { id: '2', address: '10086', body: 'sent reply', date: 1700000001000, type: 'sent' },
    ]);
    expect(native.readSms).toHaveBeenCalledWith(null, 20);
  });

  it('passes query and limit through, normalizing unknown folder types', async () => {
    native.readSms.mockResolvedValue([
      { id: '3', address: 'bank', body: 'code', date: 1, type: 'draft' },
    ]);
    const rows = await telephony.readSms({ query: 'bank', limit: 5 });
    expect(native.readSms).toHaveBeenCalledWith('bank', 5);
    expect(rows[0].type).toBe('inbox');
  });

  it('sends SMS and reports sent', async () => {
    native.sendSms.mockResolvedValue({ status: 'sent' });
    await expect(telephony.sendSms({ number: '10086', body: 'hi' })).resolves.toEqual({
      status: 'sent',
    });
    expect(native.sendSms).toHaveBeenCalledWith('10086', 'hi');
  });

  it('places a call and reports placed', async () => {
    native.call.mockResolvedValue({ status: 'placed' });
    await expect(telephony.call({ number: '10086' })).resolves.toEqual({ status: 'placed' });
    expect(native.call).toHaveBeenCalledWith('10086');
  });

  it('propagates native permission failures', async () => {
    native.sendSms.mockRejectedValue(new Error('SEND_SMS not granted on the device'));
    await expect(telephony.sendSms({ number: '1', body: 'x' })).rejects.toThrow(
      'SEND_SMS not granted',
    );
  });
});
