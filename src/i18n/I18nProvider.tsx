import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { SecureStorage } from '@/platform/secure-storage';
import { dictFor, type Dict } from './strings';

export type Locale = 'zh' | 'en';

export const LOCALE_KEY = 'i18n.locale';

export const localeNames: Record<Locale, string> = { zh: '中文', en: 'English' };

interface I18nContextValue {
  locale: Locale;
  t: Dict;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function systemLocale(): Locale {
  // RN has no navigator.language; fall back to zh (the design's locale).
  const tag: unknown = typeof navigator !== 'undefined' ? navigator.language : undefined;
  return typeof tag === 'string' && tag.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

export function I18nProvider({
  children,
  storage,
}: {
  children: ReactNode;
  storage: SecureStorage;
}) {
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [_hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await storage.get(LOCALE_KEY);
      if (cancelled) {
        return;
      }
      if (stored === 'zh' || stored === 'en') {
        setLocaleState(stored);
      } else {
        setLocaleState(systemLocale());
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: dictFor(locale),
      setLocale: next => {
        setLocaleState(next);
        void storage.set(LOCALE_KEY, next);
      },
    }),
    [locale, storage],
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
