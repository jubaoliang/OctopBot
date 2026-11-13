import * as DocumentPicker from 'expo-document-picker';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { pickDocuments } from '../document-picker';
import { MediaPickerError } from '../media-picker';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: jest.fn(),
}));

const picker = DocumentPicker as jest.Mocked<typeof DocumentPicker>;
const native = requireOptionalNativeModule as jest.MockedFunction<
  typeof requireOptionalNativeModule
>;

describe('pickDocuments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Pretend the binary already linked ExpoDocumentPicker.
    native.mockReturnValue({});
  });

  it('maps system document assets into uploadable picks', async () => {
    picker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/a.pdf',
          name: 'a.pdf',
          mimeType: 'application/pdf',
          size: 2048,
          lastModified: 0,
        },
      ],
    });
    await expect(pickDocuments()).resolves.toEqual([
      {
        uri: 'file:///cache/a.pdf',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        byteSize: 2048,
      },
    ]);
    expect(picker.getDocumentAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
        base64: false,
      }),
    );
  });

  it('resolves empty on cancel', async () => {
    picker.getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickDocuments()).resolves.toEqual([]);
  });

  it('fails closed when the native module is not linked', async () => {
    native.mockReturnValue(null);
    await expect(pickDocuments()).rejects.toBeInstanceOf(MediaPickerError);
    await expect(pickDocuments()).rejects.toMatchObject({ code: 'unavailable' });
    expect(picker.getDocumentAsync).not.toHaveBeenCalled();
  });

  it('wraps native failures as unavailable', async () => {
    picker.getDocumentAsync.mockRejectedValue(new Error('no module'));
    await expect(pickDocuments()).rejects.toBeInstanceOf(MediaPickerError);
    await expect(pickDocuments()).rejects.toMatchObject({ code: 'unavailable' });
  });
});
