/* eslint-disable react-hooks/refs -- handlersRef is only read inside async/event callbacks (start/stop/listeners), never during render; the compiler lint cannot prove that deferral */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { VoiceApi } from '@/core/api/voice';
import type { ActiveVoice } from '@/core/api/types';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import {
  AudioRecorderError,
  createAudioRecorder,
  type AudioRecorderHandle,
} from '@/platform/audio-recorder';
import { openAppSettings } from '@/platform/linking';
import { localFilePart } from '@/platform/multipart';
import { hasSeparateSpeechRecognitionPermission, speech } from '@/platform/speech';
import { speechLocaleFromUi } from '@/utils/speech-locale';

const BROWSER_STT = 'browser';

export { speechLocaleFromUi };

export interface VoiceInputHandlers {
  /** Fired when a capture session begins (before any transcript). */
  onStart?: () => void;
  /** Partial transcript while the system recognizer is still refining. */
  onInterim?: (text: string) => void;
  /** Final transcript for the session. */
  onText: (text: string) => void;
  /** Surface a user-visible failure (permission, network, empty). */
  onError?: (message: string) => void;
}

/**
 * Hybrid STT matching the Octop dashboard:
 * - `active.stt === "browser"` → system speech recognition
 * - otherwise → record audio and `POST /api/voice/stt`
 *
 * Realtime WebSocket STT is deferred; when `stt_realtime` is set we still
 * use the one-shot upload path.
 */
export function useVoiceInput(handlers: VoiceInputHandlers) {
  const { httpClient } = useAuth();
  const { locale, t: strings } = useI18n();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [active, setActive] = useState<ActiveVoice>({
    stt: BROWSER_STT,
    tts: BROWSER_STT,
  });

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const recorderRef = useRef<AudioRecorderHandle | null>(null);
  const language = speechLocaleFromUi(locale);

  useEffect(() => {
    let cancelled = false;
    void new VoiceApi(httpClient)
      .getActive()
      .then(next => {
        if (!cancelled) {
          setActive(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void recorderRef.current?.cancel();
      speech.abort();
    };
  }, [httpClient]);

  const reportError = useCallback(
    (message: string) => {
      handlersRef.current.onError?.(message);
      if (!handlersRef.current.onError) {
        Alert.alert(strings.voice.errorTitle, message);
      }
    },
    [strings.voice.errorTitle],
  );

  const stopCloud = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (!recorder) {
      return;
    }
    setTranscribing(true);
    try {
      const file = await recorder.stop();
      if (!file) {
        reportError(strings.voice.sttEmpty);
        return;
      }
      const result = await new VoiceApi(httpClient).transcribe(
        localFilePart({ uri: file.uri, name: file.filename, type: file.mimeType }),
        language,
      );
      const text = result.text?.trim() ?? '';
      if (text) {
        handlersRef.current.onText(text);
      } else {
        reportError(strings.voice.sttEmpty);
      }
    } catch {
      reportError(strings.voice.sttFailed);
    } finally {
      setTranscribing(false);
    }
  }, [httpClient, language, reportError, strings.voice.sttEmpty, strings.voice.sttFailed]);

  const promptMicPermission = useCallback(() => {
    // Always offer Settings — once the OS suppresses the prompt there is
    // no other way for the user to grant access from inside the app.
    // Android has no separate Speech Recognition toggle in App permissions.
    const message = hasSeparateSpeechRecognitionPermission()
      ? strings.voice.micDeniedSettings
      : strings.voice.micDeniedSettingsAndroid;
    Alert.alert(strings.voice.errorTitle, message, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: strings.voice.openSettings, onPress: () => openAppSettings() },
    ]);
  }, [
    strings.common.cancel,
    strings.voice.errorTitle,
    strings.voice.micDeniedSettings,
    strings.voice.micDeniedSettingsAndroid,
    strings.voice.openSettings,
  ]);

  const startSystem = useCallback(async () => {
    if (!speech.isAvailable()) {
      reportError(strings.voice.micNotAvailable);
      return;
    }
    // Ask every tap so the first undetermined state still shows the OS
    // dialog; a permanent denial surfaces Settings instead of a dead end.
    const permission = await speech.requestPermission();
    if (permission.state !== 'granted') {
      promptMicPermission();
      return;
    }

    setTranscribing(true);
    handlersRef.current.onStart?.();
    speech.start({
      lang: language,
      onResult: ({ transcript, isFinal }) => {
        if (isFinal) {
          handlersRef.current.onText(transcript);
        } else {
          handlersRef.current.onInterim?.(transcript);
        }
      },
      onError: code => {
        setTranscribing(false);
        if (code === 'network') {
          reportError(strings.voice.sttNetworkFailed);
        } else if (code !== 'aborted' && code !== 'no-speech') {
          reportError(strings.voice.sttFailed);
        }
      },
      onEnd: () => {
        setTranscribing(false);
        setRecording(false);
      },
    });
    setRecording(true);
  }, [
    language,
    promptMicPermission,
    reportError,
    strings.voice.micNotAvailable,
    strings.voice.sttFailed,
    strings.voice.sttNetworkFailed,
  ]);

  const startCloud = useCallback(async () => {
    const recorder = createAudioRecorder();
    recorderRef.current = recorder;
    handlersRef.current.onStart?.();
    try {
      await recorder.start();
      setRecording(true);
    } catch (cause) {
      recorderRef.current = null;
      if (cause instanceof AudioRecorderError && cause.code === 'unavailable') {
        reportError(strings.voice.micNotAvailable);
        return;
      }
      promptMicPermission();
    }
  }, [promptMicPermission, reportError, strings.voice.micNotAvailable]);

  const start = useCallback(async () => {
    if (recording || transcribing) {
      return;
    }
    // Branch on the cached active provider so the mic starts immediately;
    // refresh in the background for the next tap.
    const stt = active.stt || BROWSER_STT;
    void new VoiceApi(httpClient)
      .getActive()
      .then(next => setActive(next))
      .catch(() => undefined);
    if (stt === BROWSER_STT) {
      await startSystem();
    } else {
      await startCloud();
    }
  }, [active.stt, httpClient, recording, startCloud, startSystem, transcribing]);

  const stop = useCallback(async () => {
    if (recorderRef.current) {
      await stopCloud();
      return;
    }
    if (recording) {
      speech.stop();
      // Don't rely solely on the native `end` event — stop() may clear
      // listeners without emitting, which would brick the composer.
      setRecording(false);
      setTranscribing(false);
    }
  }, [recording, stopCloud]);

  const toggle = useCallback(() => {
    if (transcribing && !recording) {
      return;
    }
    if (recording) {
      void stop();
    } else {
      void start();
    }
  }, [recording, start, stop, transcribing]);

  return {
    recording,
    transcribing,
    busy: recording || transcribing,
    activeStt: active.stt || BROWSER_STT,
    start,
    stop,
    toggle,
  };
}
