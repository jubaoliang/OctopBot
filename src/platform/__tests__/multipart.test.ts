import { localFilePart } from '@/platform/multipart';

describe('localFilePart', () => {
  it('returns a FormData-compatible file part (Blob or bytes())', () => {
    const part = localFilePart({
      uri: 'file:///tmp/photo.jpg',
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
    // Expo File implements Blob in the app; Jest may see a different prototype.
    const ok =
      part instanceof Blob || (typeof part === 'object' && part !== null && 'bytes' in part);
    expect(ok).toBe(true);
    const form = new FormData();
    expect(() => form.append('file', part)).not.toThrow();
  });
});
