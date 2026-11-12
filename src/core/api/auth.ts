import type { HttpClient } from './http';
import type { HealthStatus, LoginResult, MfaChallenge, OctopUser } from './types';

export type LoginResponse = LoginResult | MfaChallenge;

/** Narrowing guard: the server returns an MFA challenge instead of a token when enrolled. */
export function isMfaChallenge(response: LoginResponse): response is MfaChallenge {
  return (response as MfaChallenge).mfa_required === true;
}

export class AuthApi {
  constructor(private readonly http: HttpClient) {}

  /** Server-URL validation at login time. Anonymous + exempt from JWT middleware. */
  health(): Promise<HealthStatus> {
    return this.http.get('/api/health', { anonymous: true });
  }

  login(username: string, password: string, captchaToken?: string): Promise<LoginResponse> {
    return this.http.post(
      '/api/auth/login',
      { username, password, captcha_token: captchaToken },
      { anonymous: true },
    );
  }

  /** Completes the MFA challenge from `login()` with the chosen factor payload. */
  verifyMfa(mfaToken: string, factor: Record<string, unknown>): Promise<LoginResult> {
    return this.http.post('/api/auth/mfa/verify', { mfa_token: mfaToken, ...factor });
  }

  me(): Promise<OctopUser> {
    return this.http.get('/api/auth/me');
  }

  logout(): Promise<void> {
    return this.http.post('/api/auth/logout');
  }

  /**
   * Updates the signed-in user's password. Server responds 204 and may slide
   * a fresh token via `X-Octop-Access-Token` (handled by HttpClient).
   */
  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    // Wrong current password must not clear the session (HttpClient would
    // otherwise treat AUTH_FAILED / 401 as a dead token).
    return this.http.post(
      '/api/auth/change-password',
      {
        old_password: oldPassword,
        new_password: newPassword,
      },
      { suppressUnauthorized: true },
    );
  }
}
