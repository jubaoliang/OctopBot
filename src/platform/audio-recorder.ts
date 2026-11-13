/**
 * Microphone capture for cloud STT uploads (`POST /api/voice/stt`).
 *
 * The ONLY place expo-audio recording APIs are imported (AGENTS.md wrapper
 * hygiene). Native modules are required lazily so a stale native binary
 * (missing ExpoAudio after a JS-only upgrade) cannot redbox the whole app
 * at ChatInput import time — cloud STT simply reports unavailable.
 */

export interface RecordedAudio {
  /** Local file URI; wrap with `localFilePart` before FormData upload. */
  uri: string;
  /** MIME type for the multipart part. */
  mimeType: string;
  /** Suggested filename for the multipart part. */
  filename: string;
}

export interface AudioRecorderHandle {
  /** Request mic permission and begin recording. */
  start: () => Promise<void>;
  /** Stop and return the captured file, or null if nothing was recorded. */
  stop: () => Promise<RecordedAudio | null>;
  /** Discard an in-flight recording without uploading. */
  cancel: () => Promise<void>;
}

export class AudioRecorderError extends Error {
  constructor(
    readonly code: 'unavailable' | 'mic_denied',
    message: string,
  ) {
    super(message);
    this.name = 'AudioRecorderError';
  }
}

type ExpoAudioModule = typeof import('expo-audio');
type ExpoAudioNativeModule = typeof import('expo-audio/build/AudioModule').default;
type AudioRecorderInstance = import('expo-audio').AudioRecorder;

interface LoadedAudio {
  audio: ExpoAudioModule;
  native: ExpoAudioNativeModule;
  voicePreset: Record<string, unknown>;
}

let cached: LoadedAudio | null | undefined;

function loadAudio(): LoadedAudio | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    // Lazy: ExpoAudio is only linked after a native rebuild with the plugin.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const audio = require('expo-audio') as ExpoAudioModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require('expo-audio/build/AudioModule').default as ExpoAudioNativeModule;
    cached = {
      audio,
      native,
      voicePreset: {
        ...audio.RecordingPresets.HIGH_QUALITY,
        numberOfChannels: 1,
        bitRate: 64_000,
      },
    };
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

/** True when the native ExpoAudio module is linked in this binary. */
export function isAudioRecorderAvailable(): boolean {
  return loadAudio() !== null;
}

function extensionOf(uri: string): string {
  const match = /\.([a-z0-9]+)(?:\?|$)/i.exec(uri);
  return match?.[1]?.toLowerCase() ?? 'm4a';
}

function mimeForExtension(ext: string): string {
  switch (ext) {
    case 'm4a':
    case 'mp4':
    case 'aac':
      return 'audio/mp4';
    case '3gp':
      return 'audio/3gpp';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    default:
      return 'audio/mp4';
  }
}

/**
 * Imperative recorder factory — keeps recording out of React trees so the
 * composer can start/stop without mounting a dedicated recorder component.
 */
export function createAudioRecorder(): AudioRecorderHandle {
  let recorder: AudioRecorderInstance | null = null;

  return {
    start: async () => {
      const loaded = loadAudio();
      if (!loaded) {
        throw new AudioRecorderError('unavailable', 'ExpoAudio native module is not linked');
      }
      const { audio, native, voicePreset } = loaded;
      const permission = await audio.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new AudioRecorderError('mic_denied', 'microphone permission denied');
      }

      await audio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const next = new native.AudioRecorder(voicePreset);
      try {
        await next.prepareToRecordAsync();
        next.record();
        recorder = next;
      } catch (cause) {
        (next as { release?: () => void }).release?.();
        await audio.setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
        throw cause;
      }
    },

    stop: async () => {
      const loaded = loadAudio();
      const current = recorder;
      recorder = null;
      if (!current) {
        return null;
      }
      await current.stop();
      const uri = current.uri;
      (current as { release?: () => void }).release?.();
      await loaded?.audio.setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      if (!uri) {
        return null;
      }
      const ext = extensionOf(uri);
      return {
        uri,
        mimeType: mimeForExtension(ext),
        filename: `recording.${ext}`,
      };
    },

    cancel: async () => {
      const loaded = loadAudio();
      const current = recorder;
      recorder = null;
      if (!current) {
        return;
      }
      try {
        await current.stop();
      } catch {
        // ignore
      }
      (current as { release?: () => void }).release?.();
      await loaded?.audio.setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
  };
}
