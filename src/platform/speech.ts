import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

/**
 * System speech recognition (Octop `active.stt === "browser"`).
 *
 * The ONLY place expo-speech-recognition is imported (AGENTS.md wrapper
 * hygiene). Screens call this module — never the Expo package directly.
 */

export type SpeechPermissionState = 'granted' | 'denied' | 'undetermined';

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

export interface SpeechSessionOptions {
  /** BCP-47 language tag, e.g. `zh-CN` / `en-US`. */
  lang: string;
  onResult: (result: SpeechResult) => void;
  onError: (code: string, message: string) => void;
  onEnd: () => void;
}

export interface SpeechRecognizer {
  isAvailable: () => boolean;
  getPermission: () => Promise<SpeechPermissionState>;
  requestPermission: () => Promise<SpeechPermissionState>;
  /** Start a one-shot dictation session; call `stop` to finish early. */
  start: (options: SpeechSessionOptions) => void;
  stop: () => void;
  abort: () => void;
}

function mapPermission(
  status: string | undefined,
  granted: boolean | undefined,
): SpeechPermissionState {
  if (granted) {
    return 'granted';
  }
  if (status === 'denied') {
    return 'denied';
  }
  return 'undetermined';
}

let activeCleanup: (() => void) | null = null;

function clearActive(): void {
  activeCleanup?.();
  activeCleanup = null;
}

export const speech: SpeechRecognizer = {
  isAvailable: () => {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  },

  getPermission: async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      return mapPermission(result.status, result.granted);
    } catch {
      return 'denied';
    }
  },

  requestPermission: async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return mapPermission(result.status, result.granted);
    } catch {
      return 'denied';
    }
  },

  start: options => {
    clearActive();

    const resultSub = ExpoSpeechRecognitionModule.addListener(
      'result',
      (event: ExpoSpeechRecognitionResultEvent) => {
        const top = event.results[0]?.transcript?.trim() ?? '';
        if (!top) {
          return;
        }
        options.onResult({ transcript: top, isFinal: event.isFinal });
      },
    );

    const errorSub = ExpoSpeechRecognitionModule.addListener(
      'error',
      (event: ExpoSpeechRecognitionErrorEvent) => {
        // Abort / empty speech are user-driven or benign — surface quietly.
        if (event.error === 'aborted' || event.error === 'no-speech') {
          return;
        }
        options.onError(event.error, event.message);
      },
    );

    const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
      clearActive();
      options.onEnd();
    });

    activeCleanup = () => {
      resultSub.remove();
      errorSub.remove();
      endSub.remove();
    };

    ExpoSpeechRecognitionModule.start({
      lang: options.lang,
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
    });
  },

  stop: () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      clearActive();
    }
  },

  abort: () => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // ignore
    }
    clearActive();
  },
};
