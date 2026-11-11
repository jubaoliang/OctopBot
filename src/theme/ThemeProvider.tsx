import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance } from 'react-native';

import type { ThemeMode, ThemeTokens } from './tokens';
import { defaultPaletteId, resolveTokens } from './palettes';
import type { SecureStorage } from '@/platform/secure-storage';

/** User preference — `system` follows the OS until explicitly overridden. */
export type UserThemeMode = 'system' | ThemeMode;

export interface ThemeContextValue {
  /** The user's preference, including `system`. */
  mode: UserThemeMode;
  /** The resolved light/dark after applying `system`. */
  resolvedMode: ThemeMode;
  paletteId: string;
  tokens: ThemeTokens;
  setMode: (mode: UserThemeMode) => void;
  setPaletteId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_KEY = 'theme.mode';
const PALETTE_KEY = 'theme.palette';

function systemMode(): ThemeMode {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

function isUserMode(value: unknown): value is UserThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Theme provider: light/dark/system + accent palette, persisted through the
 * platform secure-storage wrapper. `system` follows the OS setting live.
 */
export function ThemeProvider({
  children,
  storage,
}: {
  children: ReactNode;
  storage: SecureStorage;
}) {
  const [mode, setModeState] = useState<UserThemeMode>('system');
  const [paletteId, setPaletteIdState] = useState<string>(defaultPaletteId);
  const [, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [storedMode, storedPalette] = await Promise.all([
          storage.get(MODE_KEY),
          storage.get(PALETTE_KEY),
        ]);
        if (cancelled) {
          return;
        }
        if (isUserMode(storedMode)) {
          setModeState(storedMode);
        }
        if (storedPalette) {
          setPaletteIdState(storedPalette);
        }
      } catch {
        // Secure storage unavailable — defaults are fine.
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const setMode = useCallback(
    (next: UserThemeMode) => {
      setModeState(next);
      void storage.set(MODE_KEY, next);
    },
    [storage],
  );

  const setPaletteId = useCallback(
    (next: string) => {
      setPaletteIdState(next);
      void storage.set(PALETTE_KEY, next);
    },
    [storage],
  );

  // OS scheme flips only affect the resolved theme while preference is system.
  const [systemScheme, setSystemScheme] = useState<ThemeMode>(() => systemMode());
  useEffect(() => {
    const subscription = Appearance.addChangeListener(() => {
      setSystemScheme(systemMode());
    });
    return () => subscription.remove();
  }, []);

  const resolvedMode: ThemeMode = mode === 'system' ? systemScheme : mode;

  const value = useMemo<ThemeContextValue>(() => {
    const tokens = resolveTokens(resolvedMode, paletteId);
    return { mode, resolvedMode, paletteId, tokens, setMode, setPaletteId };
  }, [mode, resolvedMode, paletteId, setMode, setPaletteId]);

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
