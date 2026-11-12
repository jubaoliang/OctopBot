import type { ViewStyle, TextStyle } from 'react-native';

/**
 * Semantic design tokens for OctopBot.
 *
 * Colors, layout and component anatomy come from the Ardot design file
 * (https://ardot.tencent.com/file/745886345003849) — the design uses
 * black-alpha overlays on #FAFAFA, which map to white-alpha overlays in
 * dark mode. Accent colors are palette-driven (see palettes.ts), never
 * hardcoded in components.
 *
 * Metrics follow Apple's Human Interface Guidelines where the two differ:
 * the type ramp is the iOS text-style ramp, touch targets are 44pt, and
 * rounded shapes use continuous corners (see AGENTS.md, "Design source of
 * truth").
 */

export interface ThemeTokens {
  bg: string;
  surface: string;
  /** A surface that sits on a tinted fill (segmented-control thumb). */
  surfaceRaised: string;
  scrim: string;
  /** Subtle fill: user bubble, active row, code chip (design: black 4%). */
  overlaySubtle: string;
  /** Pressed-row highlight, one step stronger than `overlaySubtle`. */
  overlayPressed: string;
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
  dangerSoft: string;
  /** Positive status (an expert that is running). */
  success: string;
  /** Ambient shadow under the composer (design: black 5%, radius 32). */
  shadow: string;
  /** Lift under pills and chips (design: black 3%, y 4, radius 20). */
  shadowSoft: string;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const layout = {
  /** HIG minimum touch target; smaller glyphs reach it through hitSlop. */
  hitTarget: 44,
  /** Leading/trailing screen margin on compact widths. */
  screenMargin: 16,
  /** List rows are at least one touch target tall. */
  rowMinHeight: 44,
  /** Space between the keyboard's top edge and the content riding on it. */
  keyboardGap: 8,
} as const;

export const radius = {
  chip: 4,
  pill: 8,
  input: 12,
  card: 12,
  bubble: 18,
  bubbleTail: 4,
  sheet: 20,
} as const;

/**
 * iOS draws rounded rectangles with continuous (superellipse) corners;
 * spread this next to any `borderRadius`. Ignored on Android.
 */
export const continuousCorners: ViewStyle = { borderCurve: 'continuous' };

/**
 * The iOS text-style ramp (size/leading at the default Dynamic Type size).
 * Components set fontWeight, never fontFamily, so iOS resolves SF Pro /
 * PingFang SC and Android its system font. `reading` is `body` with looser
 * leading for multi-line CJK message text.
 */
export type TypeStyleName =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'reading'
  | 'callout'
  | 'subheadline'
  | 'footnote'
  | 'caption1'
  | 'caption2';

export type TypeScale = Record<TypeStyleName, TextStyle>;

export const typeScale: TypeScale = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  reading: { fontSize: 17, lineHeight: 25, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' },
};

/**
 * Motion constants shared by every animated component, so press feedback
 * and sheets feel like one system.
 */
export const motion = {
  /** Press feedback duration (ms) — near-imperceptible by design. */
  press: 120,
  /** Small state changes: toggles, chips, segmented thumb (ms). */
  state: 200,
  /** Sheets and the drawer (ms). */
  sheet: 300,
} as const;

export type ThemeMode = 'light' | 'dark';

export const lightTokens: ThemeTokens = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  scrim: 'rgba(0,0,0,0.40)',
  overlaySubtle: 'rgba(0,0,0,0.04)',
  overlayPressed: 'rgba(0,0,0,0.08)',
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
  dangerSoft: 'rgba(229,72,77,0.12)',
  success: '#2B9A66',
  shadow: 'rgba(0,0,0,0.05)',
  shadowSoft: 'rgba(0,0,0,0.03)',
};

export const darkTokens: ThemeTokens = {
  bg: '#0E0F13',
  surface: '#1A1C22',
  surfaceRaised: '#2C2F38',
  scrim: 'rgba(0,0,0,0.60)',
  overlaySubtle: 'rgba(255,255,255,0.06)',
  overlayPressed: 'rgba(255,255,255,0.12)',
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
  dangerSoft: 'rgba(240,106,110,0.16)',
  success: '#4CC38A',
  shadow: 'rgba(0,0,0,0.40)',
  shadowSoft: 'rgba(0,0,0,0.30)',
};

/** Style helpers so components never hardcode token values. */
export type ComponentStyle = ViewStyle & TextStyle;
