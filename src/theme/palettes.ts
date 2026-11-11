import { lightTokens, darkTokens, type ThemeMode, type ThemeTokens } from './tokens';

/**
 * Accent palettes — the default is the Ardot design's link blue; the rest
 * echo the original Octop palette lineup. Palettes only override accent
 * colors; neutral tokens stay per-mode.
 */
export interface Palette {
  id: string;
  name: string;
  accent: { light: string; dark: string };
  accentSoft: { light: string; dark: string };
}

export const palettes: Palette[] = [
  {
    // The design file is monochrome — ink is the default and the
    // constitution; colored palettes are opt-in preferences only.
    id: 'ink',
    name: 'Ink',
    accent: { light: '#111827', dark: '#F3F4F6' },
    accentSoft: { light: 'rgba(0,0,0,0.04)', dark: 'rgba(255,255,255,0.06)' },
  },
  {
    id: 'octop-blue',
    name: 'Octop Blue',
    accent: { light: '#2F82D1', dark: '#5B9FDC' },
    accentSoft: { light: 'rgba(47,130,209,0.12)', dark: 'rgba(91,159,220,0.16)' },
  },
  {
    id: 'violet',
    name: 'Violet',
    accent: { light: '#7C5CD6', dark: '#A18BE8' },
    accentSoft: { light: 'rgba(124,92,214,0.12)', dark: 'rgba(161,139,232,0.16)' },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    accent: { light: '#12946A', dark: '#4DBE96' },
    accentSoft: { light: 'rgba(18,148,106,0.12)', dark: 'rgba(77,190,150,0.16)' },
  },
  {
    id: 'rose',
    name: 'Rose',
    accent: { light: '#D64570', dark: '#E87A9B' },
    accentSoft: { light: 'rgba(214,69,112,0.12)', dark: 'rgba(232,122,155,0.16)' },
  },
  {
    id: 'amber',
    name: 'Amber',
    accent: { light: '#C77E1E', dark: '#E3A84F' },
    accentSoft: { light: 'rgba(199,126,30,0.12)', dark: 'rgba(227,168,79,0.16)' },
  },
  {
    id: 'cyan',
    name: 'Cyan',
    accent: { light: '#0E8FA3', dark: '#54B9CB' },
    accentSoft: { light: 'rgba(14,143,163,0.12)', dark: 'rgba(84,185,203,0.16)' },
  },
] as const;

export const defaultPaletteId = 'ink';

export function resolveTokens(mode: ThemeMode, paletteId: string): ThemeTokens {
  const base = mode === 'dark' ? darkTokens : lightTokens;
  const palette = palettes.find(p => p.id === paletteId) ?? palettes[0];
  return {
    ...base,
    accent: palette.accent[mode],
    accentSoft: palette.accentSoft[mode],
  };
}
