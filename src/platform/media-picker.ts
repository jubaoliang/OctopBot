import type { AttachSource } from '@/core/api/attachments';

/**
 * Image selection for chat attachments.
 *
 * The ONLY place expo-image-picker / expo-file-system are imported for
 * attachments (AGENTS.md wrapper hygiene). Native modules are required lazily
 * so a rebuild lag does not crash the app at import time — pick then fails
 * closed with `unavailable`.
 */

export interface PickedImage {
  /** Local file URI the upload client can append to FormData. */
  uri: string;
  filename: string;
  mimeType: string;
  /** Bytes on disk; absent when neither the picker nor the file system knew. */
  byteSize?: number;
}

export type MediaPickerErrorCode = 'denied' | 'unavailable';

/** Thrown for permission refusal or a missing native module. Cancel is `[]`, not an error. */
export class MediaPickerError extends Error {
  constructor(readonly code: MediaPickerErrorCode) {
    super(code);
    this.name = 'MediaPickerError';
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const PICKER_OPTIONS = { mediaTypes: ['images' as const], quality: 0.85 };

type ImagePickerModule = typeof import('expo-image-picker');
type ImagePickerResult = import('expo-image-picker').ImagePickerResult;

function loadImagePicker(): ImagePickerModule {
  try {
    // Lazy: ExpoImagePicker is only linked after a native rebuild.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker') as ImagePickerModule;
  } catch {
    throw new MediaPickerError('unavailable');
  }
}

function extensionOf(name: string): string | null {
  const match = /\.([a-z0-9]+)(?:\?|$)/i.exec(name);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Fills in the filename / MIME type the picker may leave empty. */
export function describeAsset(
  asset: { uri: string; fileName?: string | null; mimeType?: string; fileSize?: number },
  index: number,
  now: number = Date.now(),
): PickedImage {
  const ext = extensionOf(asset.fileName ?? '') ?? extensionOf(asset.uri) ?? 'jpg';
  const mimeType =
    asset.mimeType && asset.mimeType.startsWith('image/')
      ? asset.mimeType
      : (MIME_BY_EXTENSION[ext] ?? 'image/jpeg');
  const filename =
    asset.fileName && asset.fileName.length > 0 ? asset.fileName : `image-${now}-${index}.${ext}`;
  return { uri: asset.uri, filename, mimeType, byteSize: asset.fileSize };
}

async function withByteSize(image: PickedImage): Promise<PickedImage> {
  if (image.byteSize !== undefined) {
    return image;
  }
  try {
    const { getInfoAsync } =
      require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    const info = await getInfoAsync(image.uri);
    return info.exists ? { ...image, byteSize: info.size } : image;
  } catch {
    // Size is advisory; the server still enforces its own limit.
    return image;
  }
}

async function finish(result: ImagePickerResult): Promise<PickedImage[]> {
  if (result.canceled) {
    return [];
  }
  const now = Date.now();
  return Promise.all(
    result.assets.map((asset, index) => withByteSize(describeAsset(asset, index, now))),
  );
}

/**
 * Library allows several images; camera captures exactly one. Resolves `[]`
 * when the user cancels; rejects with `MediaPickerError` on denial or when
 * the native module is missing. Files go through `pickDocuments` instead.
 */
export async function pickImages(source: Exclude<AttachSource, 'files'>): Promise<PickedImage[]> {
  try {
    const ImagePicker = loadImagePicker();
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new MediaPickerError('denied');
      }
      return await finish(await ImagePicker.launchCameraAsync({ ...PICKER_OPTIONS }));
    }
    // The system photo picker needs no library permission to read picks.
    return await finish(
      await ImagePicker.launchImageLibraryAsync({
        ...PICKER_OPTIONS,
        allowsMultipleSelection: true,
      }),
    );
  } catch (cause) {
    if (cause instanceof MediaPickerError) {
      throw cause;
    }
    throw new MediaPickerError('unavailable');
  }
}
