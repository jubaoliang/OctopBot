import * as ExpoContacts from 'expo-contacts';

import { contactsReader } from '../contacts';

jest.mock('expo-contacts', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  Contact: { getAll: jest.fn() },
  ContactsSortOrder: { USER_DEFAULT: 'userDefault', GIVEN_NAME: 'givenName' },
}));

const expo = jest.mocked(ExpoContacts);

describe('contactsReader', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('maps permission responses', async () => {
    (expo.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    await expect(contactsReader.getPermissionStatus()).resolves.toBe('granted');
    (expo.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      status: 'denied',
    });
    await expect(contactsReader.requestPermissions()).resolves.toBe('denied');
    (expo.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await expect(contactsReader.getPermissionStatus()).resolves.toBe('undetermined');
  });

  it('maps contacts to lightweight cards', async () => {
    (expo.Contact.getAll as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        fullName: 'Jane Doe',
        phones: [{ id: 'ph1', label: 'mobile', number: ' +86 138 0000 0000 ' }],
        emails: [{ id: 'em1', label: 'work', email: 'jane@example.com' }],
      },
      { id: 'p2', givenName: 'Solo', familyName: null, phones: [], emails: [] },
    ]);
    const cards = await contactsReader.listContacts();
    expect(expo.Contact.getAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));
    expect(cards).toEqual([
      { id: 'p1', name: 'Jane Doe', phones: ['+86 138 0000 0000'], emails: ['jane@example.com'] },
      { id: 'p2', name: 'Solo', phones: [], emails: [] },
    ]);
  });

  it('degrades query failures to an empty list', async () => {
    (expo.Contact.getAll as jest.Mock).mockRejectedValue(new Error('denied'));
    await expect(contactsReader.listContacts()).resolves.toEqual([]);
  });
});
