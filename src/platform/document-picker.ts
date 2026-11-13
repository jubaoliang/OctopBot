/**
 * System document picker for chat file attachments.
 *
 * The ONLY place expo-document-picker is imported (AGENTS.md wrapper hygiene).
 * Probe the native module before requiring the JS package — requiring the
 * package when the binary is stale throws into LogBox even inside try/catch.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';

import { MediaPickerError, type PickedImage } from '@/platform/media-picker';

type DocumentPickerModule = typeof import('expo-document-picker');

function loadDocumentPicker(): DocumentPickerModule {
  // Fail closed before `require('expo-document-picker')` — that package
  // eagerly binds ExpoDocumentPicker and redboxes when it is missing.
  if (!requireOptionalNativeModule('ExpoDocumentPicker')) {
    throw new MediaPickerError('unavailable');
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-document-picker') as DocumentPickerModule;
  } catch {
    throw new MediaPickerError('unavailable');
  }
}

function extensionOf(name: string): string | null {
  const match = /\.([a-z0-9]+)(?:\?|$)/i.exec(name);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * Opens the system Files / document UI. Resolves `[]` on cancel; rejects
 * with `MediaPickerError` when the native module is missing.
 */
export async function pickDocuments(): Promise<PickedImage[]> {
  try {
    const DocumentPicker = loadDocumentPicker();
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
      // Upload goes through FormData from a file URI — base64 is wasted work.
      base64: false,
    });
    if (result.canceled || !result.assets) {
      return [];
    }
    const now = Date.now();
    return result.assets.map((asset, index) => {
      const name =
        asset.name && asset.name.length > 0
          ? asset.name
          : `file-${now}-${index}${extensionOf(asset.uri) ? `.${extensionOf(asset.uri)}` : ''}`;
      return {
        uri: asset.uri,
        filename: name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        byteSize: asset.size ?? undefined,
      };
    });
  } catch (cause) {
    if (cause instanceof MediaPickerError) {
      throw cause;
    }
    throw new MediaPickerError('unavailable');
  }
}
