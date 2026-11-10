import { OctopApiError, parseApiError } from '../errors';

describe('parseApiError', () => {
  it('parses the standard error envelope', () => {
    const error = parseApiError(401, {
      error: { code: 'TOKEN_EXPIRED', message: 'token expired', details: { at: 'now' } },
    });
    expect(error).toBeInstanceOf(OctopApiError);
    expect(error.status).toBe(401);
    expect(error.code).toBe('TOKEN_EXPIRED');
    expect(error.message).toBe('token expired');
    expect(error.details).toEqual({ at: 'now' });
    expect(error.isAuthFailure).toBe(true);
  });

  it('falls back to FastAPI detail bodies', () => {
    const error = parseApiError(422, { detail: 'validation failed' });
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.message).toBe('validation failed');
    expect(error.isAuthFailure).toBe(false);
  });

  it('falls back to a bare status line for non-JSON bodies', () => {
    const error = parseApiError(502, 'Bad Gateway');
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.message).toBe('HTTP 502');
  });

  it('flags setup-required responses', () => {
    expect(
      parseApiError(409, { error: { code: 'SETUP_REQUIRED', message: 'x' } }).isSetupRequired,
    ).toBe(true);
    expect(parseApiError(503, { setup_required: true }).isSetupRequired).toBe(true);
  });

  it('does not treat every envelope as an auth failure', () => {
    const error = parseApiError(404, { error: { code: 'AGENT_NOT_FOUND', message: 'x' } });
    expect(error.isAuthFailure).toBe(false);
  });
});
