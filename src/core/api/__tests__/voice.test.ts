import { VoiceApi } from '../voice';
import type { HttpClient } from '../http';

function mockHttp(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    postForm: jest.fn(),
    requestRaw: jest.fn(),
    ...overrides,
  } as unknown as HttpClient;
}

describe('VoiceApi', () => {
  it('reads the active STT/TTS pair', async () => {
    const http = mockHttp({
      get: jest.fn().mockResolvedValue({ stt: 'browser', tts: 'browser', stt_realtime: false }),
    });
    await expect(new VoiceApi(http).getActive()).resolves.toEqual({
      stt: 'browser',
      tts: 'browser',
      stt_realtime: false,
    });
    expect(http.get).toHaveBeenCalledWith('/api/voice/active');
  });

  it('updates the active STT provider', async () => {
    const http = mockHttp({
      put: jest.fn().mockResolvedValue({ stt: 'openai', tts: 'browser' }),
    });
    await new VoiceApi(http).setActive({ stt: 'openai' });
    expect(http.put).toHaveBeenCalledWith('/api/voice/active', { stt: 'openai' });
  });

  it('lists voice providers', async () => {
    const http = mockHttp({
      get: jest
        .fn()
        .mockResolvedValue([
          { id: 1, name: 'openai', kind: 'openai', capability: 'stt', enabled: true },
        ]),
    });
    const rows = await new VoiceApi(http).listProviders();
    expect(rows).toHaveLength(1);
    expect(http.get).toHaveBeenCalledWith('/api/voice/providers');
  });

  it('uploads audio via multipart form', async () => {
    const postForm = jest.fn().mockResolvedValue({ text: '你好', confidence: 0.9 });
    const http = mockHttp({ postForm });
    const result = await new VoiceApi(http).transcribe(
      new Blob(['fake'], { type: 'audio/mp4' }),
      'zh-CN',
      'openai',
    );
    expect(result.text).toBe('你好');
    expect(postForm).toHaveBeenCalledWith('/api/voice/stt', expect.any(FormData));
    const form = postForm.mock.calls[0][1] as FormData;
    expect(form).toBeInstanceOf(FormData);
  });
});
