import type { HttpClient } from './http';
import type { ActiveVoice, VoiceProvider, VoiceTranscribeResult } from './types';

/** RN FormData file part — fetch serializes `{ uri, name, type }` as a blob. */
export interface VoiceAudioPart {
  uri: string;
  name: string;
  type: string;
}

/**
 * Voice STT/TTS configuration and transcription (docs/api-contract.md).
 * Provider admin CRUD stays out of scope; the mobile client only reads
 * providers, picks the active STT, and uploads audio for cloud STT.
 */
export class VoiceApi {
  constructor(private readonly http: HttpClient) {}

  getActive(): Promise<ActiveVoice> {
    return this.http.get('/api/voice/active');
  }

  setActive(body: { stt?: string; tts?: string }): Promise<ActiveVoice> {
    return this.http.put('/api/voice/active', body);
  }

  listProviders(): Promise<VoiceProvider[]> {
    return this.http.get('/api/voice/providers');
  }

  transcribe(
    audio: VoiceAudioPart,
    language: string,
    provider?: string,
  ): Promise<VoiceTranscribeResult> {
    const form = new FormData();
    // React Native's FormData accepts a file descriptor object here.
    form.append('audio', audio as unknown as Blob);
    form.append('language', language);
    if (provider) {
      form.append('provider', provider);
    }
    return this.http.postForm('/api/voice/stt', form);
  }
}
