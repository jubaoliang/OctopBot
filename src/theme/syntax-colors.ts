import type { ThemeMode, ThemeTokens } from './tokens';
import type { SyntaxRole } from '@/utils/syntax-highlight';

/**
 * Syntax-highlight colors for chat fences.
 *
 * - Neutrals (plain / comment / meta / punctuation) come from text tokens.
 * - Semantic diff roles (addition / deletion) use success / danger so they
 *   stay readable on every accent.
 * - Keyword and function-name hues are fixed code colors (blue / pink) —
 *   red keywords read as errors and accent-colored keywords turn alarming
 *   on warm palettes.
 * - Numeric roles (number / literal / built_in) follow the active accent;
 *   ink's near-gray accent is swapped for a purple so highlights never
 *   collapse into body text.
 */

/** Keywords read as calm structure, not as danger. */
const KEYWORD: Record<ThemeMode, string> = {
  light: '#0064D8',
  dark: '#7EB6FF',
};

/** Function names — clearly separate from keywords and numerals. */
const TITLE: Record<ThemeMode, string> = {
  light: '#C2185B',
  dark: '#F48FB1',
};

/** Stand-in for numerals when the active accent is effectively grayscale. */
const NUMBER_FALLBACK: Record<ThemeMode, string> = {
  light: '#7048E8',
  dark: '#B197FC',
};

/** Warm secondary for attrs — kept off the accent so keys ≠ values. */
const ATTR: Record<ThemeMode, string> = {
  light: '#C77E1E',
  dark: '#E3A84F',
};

export function resolveSyntaxColors(
  tokens: ThemeTokens,
  mode: ThemeMode,
): Record<SyntaxRole, string> {
  const numerals = isNearGray(tokens.accent) ? NUMBER_FALLBACK[mode] : tokens.accent;
  return {
    plain: tokens.textBody,
    comment: tokens.textTertiary,
    meta: tokens.textSecondary,
    punctuation: tokens.textSecondary,
    keyword: KEYWORD[mode],
    title: TITLE[mode],
    string: tokens.success,
    addition: tokens.success,
    deletion: tokens.danger,
    number: numerals,
    literal: numerals,
    built_in: numerals,
    attr: ATTR[mode],
  };
}

/** True when R/G/B are nearly equal — ink accent, pure black/white, etc. */
export function isNearGray(color: string): boolean {
  const rgb = parseCssColor(color);
  if (!rgb) {
    return false;
  }
  const [r, g, b] = rgb;
  return Math.max(r, g, b) - Math.min(r, g, b) < 28;
}

function parseCssColor(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const raw = hex[1];
    const full =
      raw.length === 3
        ? raw
            .split('')
            .map(ch => ch + ch)
            .join('')
        : raw;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
    ];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color.trim());
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  }
  return null;
}
