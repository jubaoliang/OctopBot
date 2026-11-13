import type { HttpClient } from './http';
import type { ActiveVoice, VoiceProvider, VoiceTranscribeResult } from './types';

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

  /**
   * Cloud STT upload. Pass a Blob from `localFilePart` — Expo fetch rejects
   * React Native `{ uri, name, type }` FormData descriptors.
   */
  transcribe(audio: Blob, language: string, provider?: string): Promise<VoiceTranscribeResult> {
    const form = new FormData();
    form.append('audio', audio);
    form.append('language', language);
    if (provider) {
      form.append('provider', provider);
    }
    return this.http.postForm('/api/voice/stt', form);
  }
}
