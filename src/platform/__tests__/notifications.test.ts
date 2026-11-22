import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

import { localNotifications } from '../notifications';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  clearLastNotificationResponseAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}));
// The wrapper imports the enum from its defining module (see the wrapper's
// import comment) — mock that specifier too so no real module loads.
jest.mock('expo-notifications/build/NotificationChannelManager.types', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}));

const expo = jest.mocked(ExpoNotifications);

describe('localNotifications (native)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (expo.setNotificationHandler as jest.Mock).mockResolvedValue(undefined);
    (expo.setNotificationChannelAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('configures the foreground handler', async () => {
    localNotifications.configure();
    expect(expo.setNotificationHandler).toHaveBeenCalledTimes(1);
    const behavior = await (
      expo.setNotificationHandler as jest.Mock
    ).mock.calls[0][0].handleNotification();
    expect(behavior).toMatchObject({ shouldShowBanner: true, shouldShowList: true });
  });

  it('maps permission statuses', async () => {
    (expo.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    await expect(localNotifications.requestPermission()).resolves.toBe('granted');
    (expo.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await expect(localNotifications.getPermissionStatus()).resolves.toBe('denied');
    (expo.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    await expect(localNotifications.getPermissionStatus()).resolves.toBe('undetermined');
  });

  it('degrades permission rejections to denied', async () => {
    (expo.requestPermissionsAsync as jest.Mock).mockRejectedValue(new Error('unsupported'));
    await expect(localNotifications.requestPermission()).resolves.toBe('denied');
  });

  it('presents local notifications with tap data', async () => {
    (expo.scheduleNotificationAsync as jest.Mock).mockResolvedValue('id');
    await localNotifications.presentLocal({
      title: 'Assistant',
      body: 'Digest ready',
      data: { agentId: 'main', threadId: 't-1' },
    });
    expect(expo.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Assistant',
        body: 'Digest ready',
        data: { agentId: 'main', threadId: 't-1' },
      },
      // iOS (test env): immediate delivery trigger is null; see presentLocal.
      trigger: null,
    });
  });

  it('rides the high-importance Android channel when presenting', async () => {
    const originalOs = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      (expo.scheduleNotificationAsync as jest.Mock).mockResolvedValue('id');
      await localNotifications.presentLocal({ title: 'x' });
      expect(expo.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: { channelId: 'alerts' } }),
      );
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true });
    }
  });

  it('creates a HIGH-importance channel so nudges heads-up banner', () => {
    const originalOs = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      localNotifications.configure();
      expect(expo.setNotificationChannelAsync).toHaveBeenCalledWith(
        'alerts',
        expect.objectContaining({ importance: 4 }),
      );
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true });
    }
  });

  it('swallows presentation failures', async () => {
    (expo.scheduleNotificationAsync as jest.Mock).mockRejectedValue(new Error('no channel'));
    await expect(localNotifications.presentLocal({ title: 'x' })).resolves.toBeUndefined();
  });

  it('routes tap responses to the callback and unsubscribes', () => {
    const remove = jest.fn();
    (expo.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove });
    const seen: unknown[] = [];
    const unsubscribe = localNotifications.onTap(tap => seen.push(tap.data));
    const listener = (expo.addNotificationResponseReceivedListener as jest.Mock).mock
      .calls[0][0] as (response: unknown) => void;
    listener({ notification: { request: { content: { data: { threadId: 't-9' } } } } });
    expect(seen).toEqual([{ threadId: 't-9' }]);
    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('maps the cold-start tap', async () => {
    (expo.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue({
      notification: { request: { content: { data: { threadId: 't-2' } } } },
    });
    await expect(localNotifications.getInitialTap()).resolves.toEqual({
      data: { threadId: 't-2' },
    });
    (expo.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);
    await expect(localNotifications.getInitialTap()).resolves.toBeNull();
  });
});
