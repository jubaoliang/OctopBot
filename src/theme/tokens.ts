import type { ViewStyle, TextStyle } from 'react-native';

/**
 * Semantic design tokens for OctopBot.
 *
 * Literal values for the light theme come from the Ardot design file
 * (https://ardot.tencent.com/file/745886345003849) — the design uses
 * black-alpha overlays on #FAFAFA, which map to white-alpha overlays in
 * dark mode. Accent colors are palette-driven (see palettes.ts), never
 * hardcoded in components.
 */

export interface ThemeTokens {
  bg: string;
  surface: string;
  scrim: string;
  /** Subtle fill: user bubble, active row, code chip (design: black 4%). */
  overlaySubtle: string;
  /** Hairline borders (design: black 6–8%). */
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textBody: string;
  textSecondary: string;
  textTertiary: string;
  textPlaceholder: string;
  textInverse: string;
  accent: string;
  accentSoft: string;
  danger: string;
  shadow: string;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

export const radius = {
  chip: 4,
  pill: 8,
  input: 12,
  bubble: 16,
  bubbleTail: 4,
} as const;

/**
 * Type sizing per design (PingFang SC on iOS; system font on Android —
 * components set fontWeight, never fontFamily).
 */
export type TypeScale = Record<
  'heading' | 'title' | 'body' | 'bodySmall' | 'caption' | 'tabLabel' | 'code',
  TextStyle
>;

export const typeScale: TypeScale = {
  // 24/32 Semibold — chat home greeting.
  heading: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
  // 16/24 Medium — chat header title, drawer rows.
  title: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  // 15/23 Regular — chat messages.
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  // 14/22 Regular — pills, input, process card.
  bodySmall: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
  // 13/21 Regular — inline code.
  code: { fontSize: 13, lineHeight: 21, fontWeight: '400' },
  // 10/20 — tab labels.
  caption: { fontSize: 10, lineHeight: 20, fontWeight: '400' },
  tabLabel: { fontSize: 10, lineHeight: 20 },
};

export type ThemeMode = 'light' | 'dark';

export const lightTokens: ThemeTokens = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  scrim: 'rgba(0,0,0,0.40)',
  overlaySubtle: 'rgba(0,0,0,0.04)',
  borderSubtle: 'rgba(0,0,0,0.06)',
  borderStrong: 'rgba(0,0,0,0.08)',
  textPrimary: '#111827',
  textBody: 'rgba(0,0,0,0.90)',
  textSecondary: 'rgba(0,0,0,0.60)',
  textTertiary: 'rgba(0,0,0,0.50)',
  textPlaceholder: 'rgba(0,0,0,0.30)',
  textInverse: '#FFFFFF',
  accent: '#2F82D1', // overridden by the active palette
  accentSoft: 'rgba(47,130,209,0.12)',
  danger: '#E5484D',
  shadow: 'rgba(0,0,0,0.05)',
};

export const darkTokens: ThemeTokens = {
  bg: '#0E0F13',
  surface: '#1A1C22',
  scrim: 'rgba(0,0,0,0.60)',
  overlaySubtle: 'rgba(255,255,255,0.06)',
  borderSubtle: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.14)',
  textPrimary: '#F3F4F6',
  textBody: 'rgba(255,255,255,0.90)',
  textSecondary: 'rgba(255,255,255,0.60)',
  textTertiary: 'rgba(255,255,255,0.50)',
  textPlaceholder: 'rgba(255,255,255,0.30)',
  textInverse: '#0E0F13',
  accent: '#5B9FDC',
  accentSoft: 'rgba(91,159,220,0.16)',
  danger: '#F06A6E',
  shadow: 'rgba(0,0,0,0.40)',
};

/** Style helpers so components never hardcode token values. */
export type ComponentStyle = ViewStyle & TextStyle;
