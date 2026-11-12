import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
// Default native module — carries the AudioRecorder class used imperatively.
import ExpoAudioNative from 'expo-audio/build/AudioModule';

/**
 * Microphone capture for cloud STT uploads (`POST /api/voice/stt`).
 *
 * The ONLY place expo-audio recording APIs are imported (AGENTS.md wrapper
 * hygiene). System dictation lives in `speech.ts` instead.
 */

export interface RecordedAudio {
  /** Local file URI the upload client can append to FormData. */
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

/** Voice-oriented AAC mono — smaller than the stereo HIGH_QUALITY preset. */
const VOICE_PRESET = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64_000,
};

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
  let recorder: AudioRecorder | null = null;

  return {
    start: async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error('mic_denied');
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const next = new ExpoAudioNative.AudioRecorder(VOICE_PRESET);
      try {
        await next.prepareToRecordAsync();
        next.record();
        recorder = next;
      } catch (cause) {
        (next as { release?: () => void }).release?.();
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
        throw cause;
      }
    },

    stop: async () => {
      const current = recorder;
      recorder = null;
      if (!current) {
        return null;
      }
      await current.stop();
      const uri = current.uri;
      // SharedObject cleanup — typed loosely across expo-audio builds.
      (current as { release?: () => void }).release?.();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
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
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
  };
}
