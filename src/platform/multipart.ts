/**
 * Multipart file parts for Expo's WinterCG fetch.
 *
 * Expo SDK 58's global fetch rejects React Native's `{ uri, name, type }`
 * FormData descriptors ("Unsupported FormDataPart implementation"). Append
 * an `expo-file-system` `File` (Blob + bytes) instead. This is the ONLY place
 * that adapter is constructed for uploads (AGENTS.md wrapper hygiene).
 */

export interface LocalFilePart {
  uri: string;
  name: string;
  type: string;
}

type FileModule = typeof import('expo-file-system');

function loadFileClass(): FileModule['File'] | null {
  try {
    // Lazy: avoid hard-failing Jest / web when the native module is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-file-system') as FileModule;
    return mod.File;
  } catch {
    return null;
  }
}

/**
 * Turns a local file URI into a FormData-compatible Blob for Expo fetch.
 * Falls back to a tiny Blob in non-native environments so unit tests can
 * still exercise the upload API without the filesystem module.
 */
export function localFilePart(part: LocalFilePart): Blob {
  const FileClass = loadFileClass();
  if (FileClass) {
    // `File` implements Blob and exposes name/type for Content-Disposition.
    return new FileClass(part.uri);
  }
  return new Blob([], { type: part.type });
}
