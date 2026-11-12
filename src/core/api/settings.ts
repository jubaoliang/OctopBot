import type { HttpClient } from './http';

/** Server default when `/api/settings/upload` cannot be read. */
export const DEFAULT_MAX_UPLOAD_MB = 10;

/** Read-only server settings the mobile client needs. */
export class SettingsApi {
  constructor(private readonly http: HttpClient) {}

  /** Upload size cap in MB; falls back to the default on any failure or bad value. */
  async getMaxUploadMb(): Promise<number> {
    try {
      const body = await this.http.get<{ max_upload_mb?: unknown }>('/api/settings/upload');
      const value = body.max_upload_mb;
      return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : DEFAULT_MAX_UPLOAD_MB;
    } catch {
      return DEFAULT_MAX_UPLOAD_MB;
    }
  }
}
