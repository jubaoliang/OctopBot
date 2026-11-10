import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import type { ThemeMode, ThemeTokens } from './tokens';
import { defaultPaletteId, resolveTokens } from './palettes';
import type { SecureStorage } from '@/platform/secure-storage';

export interface ThemeContextValue {
  mode: ThemeMode;
  paletteId: string;
  tokens: ThemeTokens;
  setMode: (mode: ThemeMode) => void;
  setPaletteId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_KEY = 'theme.mode';
const PALETTE_KEY = 'theme.palette';

function systemMode(): ThemeMode {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/**
 * Theme provider: light/dark mode + accent palette, persisted through the
 * platform secure-storage wrapper. Follows the system until overridden.
 */
export function ThemeProvider({
  children,
  storage,
}: {
  children: ReactNode;
  storage: SecureStorage;
}) {
  const [mode, setModeState] = useState<ThemeMode>(() => systemMode());
  const [paletteId, setPaletteIdState] = useState<string>(defaultPaletteId);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedMode, storedPalette] = await Promise.all([
        storage.get(MODE_KEY),
        storage.get(PALETTE_KEY),
      ]);
      if (cancelled) {
        return;
      }
      if (storedMode === 'light' || storedMode === 'dark') {
        setModeState(storedMode);
      }
      if (storedPalette) {
        setPaletteIdState(storedPalette);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const subscription = Appearance.addChangeListener(() => {
      setModeState(systemMode());
    });
    return () => subscription.remove();
  }, [hydrated]);

  const value = useMemo<ThemeContextValue>(() => {
    const tokens = resolveTokens(mode, paletteId);
    return {
      mode,
      paletteId,
      tokens,
      setMode: next => {
        setModeState(next);
        void storage.set(MODE_KEY, next);
      },
      setPaletteId: next => {
        setPaletteIdState(next);
        void storage.set(PALETTE_KEY, next);
      },
    };
  }, [mode, paletteId, storage]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return value;
}

/** Convenience hook: tokens only. */
export function useTokens(): ThemeTokens {
  return useTheme().tokens;
}
