import { telephony } from '../telephony';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: jest.fn(() => null),
}));

describe('telephony (no native module)', () => {
  it('reports no direct support and denied permissions', async () => {
    expect(telephony.supported).toBe(false);
    await expect(telephony.getPermissionStatus('sms')).resolves.toBe('denied');
    await expect(telephony.requestPermissions('call')).resolves.toBe('denied');
  });

  it('fails closed on every direct action', async () => {
    await expect(telephony.readSms({})).rejects.toThrow('unsupported');
    await expect(telephony.sendSms({ number: '1', body: 'x' })).rejects.toThrow('unsupported');
    await expect(telephony.call({ number: '1' })).rejects.toThrow('unsupported');
  });
});
