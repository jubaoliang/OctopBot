import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import type { SecureStorage } from '@/platform/secure-storage';
import { dictFor, type Dict } from './strings';

export type Locale = 'zh' | 'en';

/** User preference — `system` follows the OS language until overridden. */
export type UserLocaleMode = 'system' | Locale;

export const LOCALE_KEY = 'i18n.locale';

export const localeNames: Record<Locale, string> = { zh: '中文', en: 'English' };

interface I18nContextValue {
  /** The user's preference, including `system`. */
  localeMode: UserLocaleMode;
  /** The resolved zh/en after applying `system`. */
  locale: Locale;
  t: Dict;
  setLocaleMode: (mode: UserLocaleMode) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isUserLocaleMode(value: unknown): value is UserLocaleMode {
  return value === 'system' || value === 'zh' || value === 'en';
}

/** Map a BCP-47 tag to a supported UI locale. Non-English → zh (design default). */
export function localeFromTag(tag: string): Locale {
  return tag.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

/** Best-effort device language without a native locale module. */
export function readSystemLocale(): Locale {
  const candidates: string[] = [];
  try {
    const intl = Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof intl === 'string' && intl.length > 0) {
      candidates.push(intl);
    }
  } catch {
    // Intl unavailable — fall through.
  }
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    candidates.push(navigator.language);
  }
  for (const tag of candidates) {
    return localeFromTag(tag);
  }
  return 'zh';
}

export function I18nProvider({
  children,
  storage,
}: {
  children: ReactNode;
  storage: SecureStorage;
}) {
  const [localeMode, setLocaleModeState] = useState<UserLocaleMode>('system');
  const [systemLocale, setSystemLocale] = useState<Locale>(() => readSystemLocale());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await storage.get(LOCALE_KEY);
        if (cancelled) {
          return;
        }
        if (isUserLocaleMode(stored)) {
          setLocaleModeState(stored);
        }
        setSystemLocale(readSystemLocale());
      } catch {
        // Secure storage failures keep the in-memory default.
        if (!cancelled) {
          setSystemLocale(readSystemLocale());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Re-read OS language when returning to foreground while following system.
  useEffect(() => {
    if (localeMode !== 'system') {
      return;
    }
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setSystemLocale(readSystemLocale());
      }
    });
    return () => sub.remove();
  }, [localeMode]);

  const setLocaleMode = useCallback(
    (next: UserLocaleMode) => {
      setLocaleModeState(next);
      if (next === 'system') {
        setSystemLocale(readSystemLocale());
      }
      void storage.set(LOCALE_KEY, next);
    },
    [storage],
  );

  const locale: Locale = localeMode === 'system' ? systemLocale : localeMode;

  const value = useMemo<I18nContextValue>(
    () => ({
      localeMode,
      locale,
      t: dictFor(locale),
      setLocaleMode,
    }),
    [localeMode, locale, setLocaleMode],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return value;
}
