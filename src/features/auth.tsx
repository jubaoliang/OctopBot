/* eslint-disable react-hooks/refs -- the auth token ref is only read inside HttpClient's async request path, never during render; the compiler lint cannot prove that deferral */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AuthApi, isMfaChallenge } from '@/core/api/auth';
import { OctopApiError } from '@/core/api/errors';
import { HttpClient } from '@/core/api/http';
import { normalizeBaseUrl } from '@/core/api/urls';
import type { AgentSummary, OctopUser } from '@/core/api/types';
import { AgentsApi } from '@/core/api/agents';
import { Linking } from 'react-native';
import { StorageKeys, type SecureStorage } from '@/platform/secure-storage';

interface AuthContextValue {
  /** Null until the stored session (if any) is restored and validated. */
  ready: boolean;
  baseUrl: string | null;
  token: string | null;
  user: OctopUser | null;
  /** True after the server rejected a token — LoginScreen shows session_expired. */
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  /** Drop the active session (socket 4001 / explicit invalidate). */
  dropSession: () => void;
  login: (rawBaseUrl: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Updates password; HttpClient persists any slid token automatically. */
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  /** Thrown errors from login carry a stable code for the UI. */
  httpClient: HttpClient;
  /** Bumps when login/logout/drop run — callers scope in-flight work to it. */
  sessionGeneration: number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_URL_KEY = StorageKeys.baseUrl;
const TOKEN_KEY = StorageKeys.accessToken;

export class LoginFlowError extends Error {
  constructor(
    readonly code:
      'invalid_url' | 'unreachable' | 'bad_credentials' | 'mfa_required' | 'setup' | 'unknown',
    message: string,
  ) {
    super(message);
  }
}

export function AuthProvider({
  children,
  storage,
}: {
  children: ReactNode;
  storage: SecureStorage;
}) {
  const [ready, setReady] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<OctopUser | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Mirrored to React state so consumers can re-scope in-flight work.
  const [sessionGeneration, setSessionGeneration] = useState(0);

  // Token lives in a ref so the client identity is stable across sliding
  // renewals — a new client would tear down live chat sockets mid-turn.
  const tokenRef = useRef<string | null>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Bumped on login / logout / drop so late renewals and 401s from a prior
  // session cannot rewrite the active one (audit finding #3).
  const sessionGenRef = useRef(0);

  const bumpSessionGeneration = useCallback(() => {
    sessionGenRef.current += 1;
    setSessionGeneration(sessionGenRef.current);
  }, []);

  const dropSession = useCallback(() => {
    // Only flag "session expired" when a token was actually present — logout
    // and post-clear 401s must not show that copy on the login screen.
    const hadSession = tokenRef.current !== null;
    bumpSessionGeneration();
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    if (hadSession) {
      setSessionExpired(true);
    }
    void storage.delete(TOKEN_KEY);
  }, [storage, bumpSessionGeneration]);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const persistToken = useCallback(
    async (value: string, expectedGen: number) => {
      if (expectedGen !== sessionGenRef.current) {
        return;
      }
      tokenRef.current = value;
      setToken(value);
      await storage.set(TOKEN_KEY, value);
    },
    [storage],
  );

  // Keyed into httpClient deps so login/logout on the same baseUrl still
  // rebuilds the client against the new session generation.
  const sessionKey = user?.id ?? null;
  const httpClient = useMemo(() => {
    void sessionKey;
    const gen = sessionGenRef.current;
    return new HttpClient({
      baseUrl: baseUrl ?? 'http://localhost',
      getToken: () => Promise.resolve(tokenRef.current),
      onTokenRenewed: value => persistToken(value, gen),
      onUnauthorized: () => {
        if (sessionGenRef.current !== gen) {
          return;
        }
        dropSession();
      },
    });
  }, [baseUrl, sessionKey, persistToken, dropSession]);

  // Restore a persisted session, then validate it against the server.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let storedBase: string | null = null;
      let storedToken: string | null = null;
      try {
        [storedBase, storedToken] = await Promise.all([
          storage.get(BASE_URL_KEY),
          storage.get(TOKEN_KEY),
        ]);
        // Dev builds only: E2E can seed a session via
        // octopbot://dev-session?url=<base>&token=<jwt> (cold launch).
        if (__DEV__) {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl?.startsWith('octopbot://dev-session')) {
            // Manual parse — the URL global is not guaranteed in every engine.
            const query = initialUrl.slice(initialUrl.indexOf('?') + 1);
            const param = (key: string) => {
              const hit = query.split('&').find(p => p.startsWith(`${key}=`));
              return hit ? decodeURIComponent(hit.slice(key.length + 1)) : null;
            };
            const seededUrl = param('url');
            const seededToken = param('token');
            if (seededUrl && seededToken) {
              storedBase = seededUrl;
              storedToken = seededToken;
              tokenRef.current = seededToken;
              await Promise.all([
                storage.set(BASE_URL_KEY, seededUrl),
                storage.set(TOKEN_KEY, seededToken),
              ]);
            }
          }
        }
      } catch {
        // Keychain/keystore unavailable: fall through to the login gate.
      }
      if (cancelled) {
        return;
      }
      if (!storedBase || !storedToken) {
        setReady(true);
        return;
      }
      tokenRef.current = storedToken;
      setBaseUrl(storedBase);
      setToken(storedToken);
      // A client built HERE from the restored values — the memoized one
      // still points at the pre-restore baseUrl on this render.
      const restoreGen = sessionGenRef.current;
      const restoreClient = new HttpClient({
        baseUrl: storedBase,
        getToken: () => Promise.resolve(tokenRef.current),
        onTokenRenewed: renewed => persistToken(renewed, restoreGen),
        onUnauthorized: () => {
          if (sessionGenRef.current !== restoreGen) {
            return;
          }
          dropSession();
        },
      });
      try {
        const me = await new AuthApi(restoreClient).me();
        if (!cancelled) {
          setUser(me);
        }
      } catch {
        // me() failing already triggered onUnauthorized for auth errors;
        // network errors keep the session for offline-ish resilience.
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // httpClient identity changes with baseUrl/token; restore runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage]);

  const login = useMemo<AuthContextValue['login']>(
    () => async (rawBaseUrl, username, password) => {
      let base: string;
      try {
        base = normalizeBaseUrl(rawBaseUrl);
      } catch {
        throw new LoginFlowError('invalid_url', 'invalid server URL');
      }
      const client = new HttpClient({
        baseUrl: base,
        getToken: () => Promise.resolve(null),
        onTokenRenewed: () => Promise.resolve(),
        onUnauthorized: () => undefined,
      });
      const api = new AuthApi(client);
      try {
        await api.health();
      } catch (error) {
        if (error instanceof OctopApiError && error.code === 'NETWORK_ERROR') {
          throw new LoginFlowError('unreachable', 'cannot reach server');
        }
        if (error instanceof OctopApiError && error.isSetupRequired) {
          throw new LoginFlowError('setup', 'server needs first-run setup');
        }
        throw error;
      }
      let result;
      try {
        result = await api.login(username, password);
      } catch (error) {
        if (error instanceof OctopApiError && error.code === 'AUTH_FAILED') {
          throw new LoginFlowError('bad_credentials', 'wrong username or password');
        }
        throw error;
      }
      if (isMfaChallenge(result)) {
        throw new LoginFlowError('mfa_required', 'mfa challenge not supported yet');
      }
      // New generation before publishing credentials so in-flight renewals
      // from a previous session cannot overwrite this login.
      bumpSessionGeneration();
      await Promise.all([
        storage.set(BASE_URL_KEY, base),
        storage.set(TOKEN_KEY, result.access_token),
      ]);
      // Ref BEFORE state: child effects (app-shell reload) run before this
      // provider's token-sync effect in the same commit — the first
      // authenticated request must already carry the fresh token.
      tokenRef.current = result.access_token;
      setBaseUrl(base);
      setToken(result.access_token);
      setUser(result.user);
      setSessionExpired(false);
    },
    [storage, bumpSessionGeneration],
  );

  const logout = useMemo<AuthContextValue['logout']>(
    () => async () => {
      // Clear the token first so a subsequent 401 from logout() does not
      // flip sessionExpired (dropSession only flags when a token was present).
      bumpSessionGeneration();
      tokenRef.current = null;
      void new AuthApi(httpClient).logout().catch(() => undefined);
      await storage.delete(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setSessionExpired(false);
    },
    [httpClient, storage, bumpSessionGeneration],
  );

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      await new AuthApi(httpClient).changePassword(oldPassword, newPassword);
    },
    [httpClient],
  );

  // Warm-launch seeds: the cold-start path reads getInitialURL, but an
  // intent delivered while the app is running arrives as a `url` event.
  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    const sub = Linking.addEventListener('url', ({ url: initialUrl }) => {
      if (!initialUrl.startsWith('octopbot://dev-session')) {
        return;
      }
      const query = initialUrl.slice(initialUrl.indexOf('?') + 1);
      const param = (key: string) => {
        const hit = query.split('&').find(p => p.startsWith(`${key}=`));
        return hit ? decodeURIComponent(hit.slice(key.length + 1)) : null;
      };
      const seededUrl = param('url');
      const seededToken = param('token');
      if (seededUrl && seededToken) {
        bumpSessionGeneration();
        const seedGen = sessionGenRef.current;
        tokenRef.current = seededToken;
        setBaseUrl(seededUrl);
        setToken(seededToken);
        void Promise.all([
          storage.set(BASE_URL_KEY, seededUrl),
          storage.set(TOKEN_KEY, seededToken),
        ]).then(() => {
          const restoreClient = new HttpClient({
            baseUrl: seededUrl,
            getToken: () => Promise.resolve(tokenRef.current),
            onTokenRenewed: value => persistToken(value, seedGen),
            onUnauthorized: () => {
              if (sessionGenRef.current !== seedGen) {
                return;
              }
              dropSession();
            },
          });
          new AuthApi(restoreClient)
            .me()
            .then(me => {
              if (sessionGenRef.current === seedGen) {
                setUser(me);
              }
            })
            .catch(() => undefined);
        });
      }
    });
    return () => sub.remove();
  }, [storage, persistToken, dropSession, bumpSessionGeneration]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      baseUrl,
      token,
      user,
      sessionExpired,
      clearSessionExpired,
      dropSession,
      login,
      logout,
      changePassword,
      httpClient,
      sessionGeneration,
    }),
    [
      ready,
      baseUrl,
      token,
      user,
      sessionExpired,
      clearSessionExpired,
      dropSession,
      login,
      logout,
      changePassword,
      httpClient,
      sessionGeneration,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

/** Agents fetch helper shared by the shell (drawer groups, home). */
export async function fetchAgents(httpClient: HttpClient): Promise<AgentSummary[]> {
  const agents = await new AgentsApi(httpClient).list();
  return agents;
}
