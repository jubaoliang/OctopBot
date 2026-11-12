import * as ImagePicker from 'expo-image-picker';
import { getInfoAsync } from 'expo-file-system/legacy';

import { MediaPickerError, describeAsset, pickImages } from '../media-picker';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));

const picker = jest.mocked(ImagePicker);
const info = jest.mocked(getInfoAsync);

describe('describeAsset', () => {
  it('keeps picker-provided metadata', () => {
    expect(
      describeAsset(
        { uri: 'file:///a.png', fileName: 'a.png', mimeType: 'image/png', fileSize: 5 },
        0,
      ),
    ).toEqual({ uri: 'file:///a.png', filename: 'a.png', mimeType: 'image/png', byteSize: 5 });
  });

  it('derives filename and MIME type when missing', () => {
    expect(describeAsset({ uri: 'file:///cache/shot.heic' }, 2, 100)).toEqual({
      uri: 'file:///cache/shot.heic',
      filename: 'image-100-2.heic',
      mimeType: 'image/heic',
      byteSize: undefined,
    });
  });
});

describe('pickImages', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns several library images and stats missing sizes', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///1.jpg', fileName: '1.jpg', mimeType: 'image/jpeg', fileSize: 10 },
        { uri: 'file:///2.jpg', fileName: '2.jpg', mimeType: 'image/jpeg' },
      ],
    } as ImagePicker.ImagePickerResult);
    info.mockResolvedValue({
      exists: true,
      size: 99,
      uri: 'file:///2.jpg',
      isDirectory: false,
      modificationTime: 0,
    });
    const out = await pickImages('library');
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsMultipleSelection: true }),
    );
    expect(out.map(i => i.byteSize)).toEqual([10, 99]);
  });

  it('resolves [] on cancel', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    });
    await expect(pickImages('library')).resolves.toEqual([]);
  });

  it('rejects with denied when camera permission is refused', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
    } as ImagePicker.PermissionResponse);
    await expect(pickImages('camera')).rejects.toMatchObject({ code: 'denied' });
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('maps a missing native module to unavailable', async () => {
    picker.launchImageLibraryAsync.mockRejectedValue(new Error('no native module'));
    await expect(pickImages('library')).rejects.toBeInstanceOf(MediaPickerError);
    await expect(pickImages('library')).rejects.toMatchObject({ code: 'unavailable' });
  });
});
