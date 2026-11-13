import { AgentsApi } from '../agents';
import { DEFAULT_MAX_UPLOAD_MB, SettingsApi } from '../settings';
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

describe('AgentsApi.upload', () => {
  it('posts the file as multipart field `file` to the agent upload route', async () => {
    const uploaded = {
      workspace_path: 'inbound/photo.jpg',
      url: '/files/inbound/photo.jpg',
      filename: 'photo.jpg',
      media_type: 'image/jpeg',
    };
    const postForm = jest.fn().mockResolvedValue(uploaded);
    const http = mockHttp({ postForm });
    const result = await new AgentsApi(http).upload(
      'main',
      new Blob(['fake'], { type: 'image/jpeg' }),
    );
    expect(result).toEqual(uploaded);
    expect(postForm).toHaveBeenCalledWith('/api/agents/main/upload', expect.any(FormData), {
      signal: undefined,
      timeoutMs: 180_000,
    });
    const form = postForm.mock.calls[0][1] as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.has('file')).toBe(true);
  });

  it('propagates upload failures', async () => {
    const http = mockHttp({ postForm: jest.fn().mockRejectedValue(new Error('413')) });
    await expect(
      new AgentsApi(http).upload('main', new Blob(['x'], { type: 'image/png' })),
    ).rejects.toThrow('413');
  });
});

describe('SettingsApi.getMaxUploadMb', () => {
  it('reads max_upload_mb', async () => {
    const http = mockHttp({ get: jest.fn().mockResolvedValue({ max_upload_mb: 25 }) });
    await expect(new SettingsApi(http).getMaxUploadMb()).resolves.toBe(25);
    expect(http.get).toHaveBeenCalledWith('/api/settings/upload');
  });

  it('falls back to the default on failure or a bad value', async () => {
    const failing = mockHttp({ get: jest.fn().mockRejectedValue(new Error('offline')) });
    await expect(new SettingsApi(failing).getMaxUploadMb()).resolves.toBe(DEFAULT_MAX_UPLOAD_MB);
    const bad = mockHttp({ get: jest.fn().mockResolvedValue({ max_upload_mb: 'x' }) });
    await expect(new SettingsApi(bad).getMaxUploadMb()).resolves.toBe(DEFAULT_MAX_UPLOAD_MB);
  });
});
