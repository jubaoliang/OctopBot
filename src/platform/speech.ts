/**
 * System speech recognition (Octop `active.stt === "browser"`).
 *
 * The ONLY place expo-speech-recognition is imported (AGENTS.md wrapper
 * hygiene). Native modules are required lazily so a stale binary cannot
 * redbox ChatInput at import time.
 */

import { Platform } from 'react-native';

export type SpeechPermissionState = 'granted' | 'denied' | 'undetermined';

/**
 * iOS Settings lists Microphone and Speech Recognition as separate toggles.
 * Android App permissions only exposes Microphone for the same capability —
 * tip copy must not send users hunting for a Speech Recognition row.
 */
export function hasSeparateSpeechRecognitionPermission(): boolean {
  return Platform.OS === 'ios';
}

export interface SpeechPermissionResult {
  state: SpeechPermissionState;
  /**
   * When false after a denial, the OS will not show the prompt again —
   * the user must flip the toggle in Settings.
   */
  canAskAgain: boolean;
  /** iOS Content & Privacy Restrictions blocked speech recognition. */
  restricted: boolean;
}

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
  getPermission: () => Promise<SpeechPermissionResult>;
  requestPermission: () => Promise<SpeechPermissionResult>;
  /** Start a one-shot dictation session; call `stop` to finish early. */
  start: (options: SpeechSessionOptions) => void;
  stop: () => void;
  abort: () => void;
}

type SpeechModule = typeof import('expo-speech-recognition');
type ExpoSpeechRecognitionModuleType = SpeechModule['ExpoSpeechRecognitionModule'];
type ExpoSpeechRecognitionErrorEvent =
  import('expo-speech-recognition').ExpoSpeechRecognitionErrorEvent;
type ExpoSpeechRecognitionResultEvent =
  import('expo-speech-recognition').ExpoSpeechRecognitionResultEvent;

let cachedModule: ExpoSpeechRecognitionModuleType | null | undefined;

function loadSpeechModule(): ExpoSpeechRecognitionModuleType | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }
  try {
    // Lazy: ExpoSpeechRecognition is only linked after a native rebuild.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as SpeechModule;
    cachedModule = mod.ExpoSpeechRecognitionModule;
    return cachedModule;
  } catch {
    cachedModule = null;
    return null;
  }
}

function mapPermission(result: {
  status?: string;
  granted?: boolean;
  canAskAgain?: boolean;
  restricted?: boolean;
}): SpeechPermissionResult {
  if (result.granted) {
    return { state: 'granted', canAskAgain: true, restricted: false };
  }
  const restricted = result.restricted === true;
  const state: SpeechPermissionState =
    result.status === 'denied' || restricted ? 'denied' : 'undetermined';
  return {
    state,
    canAskAgain: restricted ? false : result.canAskAgain !== false,
    restricted,
  };
}

let activeCleanup: (() => void) | null = null;

function clearActive(): void {
  activeCleanup?.();
  activeCleanup = null;
}

export const speech: SpeechRecognizer = {
  isAvailable: () => {
    const mod = loadSpeechModule();
    if (!mod) {
      return false;
    }
    try {
      return mod.isRecognitionAvailable();
    } catch {
      return false;
    }
  },

  getPermission: async () => {
    const mod = loadSpeechModule();
    if (!mod) {
      return { state: 'denied', canAskAgain: false, restricted: false };
    }
    try {
      const result = await mod.getPermissionsAsync();
      return mapPermission(result);
    } catch {
      return { state: 'denied', canAskAgain: false, restricted: false };
    }
  },

  requestPermission: async () => {
    const mod = loadSpeechModule();
    if (!mod) {
      return { state: 'denied', canAskAgain: false, restricted: false };
    }
    try {
      // Request mic + recognizer together so a half-granted state cannot
      // start a session that immediately fails.
      const result = await mod.requestPermissionsAsync();
      return mapPermission(result);
    } catch {
      return { state: 'denied', canAskAgain: false, restricted: false };
    }
  },

  start: options => {
    const mod = loadSpeechModule();
    if (!mod) {
      options.onError('unavailable', 'ExpoSpeechRecognition native module is not linked');
      options.onEnd();
      return;
    }
    clearActive();

    const resultSub = mod.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
      const top = event.results[0]?.transcript?.trim() ?? '';
      if (!top) {
        return;
      }
      options.onResult({ transcript: top, isFinal: event.isFinal });
    });

    const errorSub = mod.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
      // Abort / empty speech are user-driven or benign — surface quietly.
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }
      options.onError(event.error, event.message);
    });

    const endSub = mod.addListener('end', () => {
      clearActive();
      options.onEnd();
    });

    activeCleanup = () => {
      resultSub.remove();
      errorSub.remove();
      endSub.remove();
    };

    mod.start({
      lang: options.lang,
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
    });
  },

  stop: () => {
    const mod = loadSpeechModule();
    try {
      mod?.stop();
    } catch {
      clearActive();
    }
  },

  abort: () => {
    const mod = loadSpeechModule();
    try {
      mod?.abort();
    } catch {
      // ignore
    }
    clearActive();
  },
};
