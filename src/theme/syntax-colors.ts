import type { ThemeMode, ThemeTokens } from './tokens';
import type { SyntaxRole } from '@/utils/syntax-highlight';

/**
 * Syntax-highlight colors for chat fences.
 *
 * - Neutrals (plain / comment / meta / punctuation) come from text tokens.
 * - Semantic roles (keyword / string / addition / deletion) use danger /
 *   success so they stay readable on every accent.
 * - Identity roles (built_in / number / literal / title / attr) follow the
 *   active accent. Ink's near-gray accent is swapped for Octop Blue so
 *   highlights never collapse into body text.
 */

/** Readable stand-in when the active accent is effectively grayscale (ink). */
const FALLBACK_ACCENT: Record<ThemeMode, string> = {
  light: '#2F82D1',
  dark: '#5B9FDC',
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
  const accent = isNearGray(tokens.accent) ? FALLBACK_ACCENT[mode] : tokens.accent;
  return {
    plain: tokens.textBody,
    comment: tokens.textTertiary,
    meta: tokens.textSecondary,
    punctuation: tokens.textSecondary,
    keyword: tokens.danger,
    string: tokens.success,
    addition: tokens.success,
    deletion: tokens.danger,
    number: accent,
    literal: accent,
    built_in: accent,
    title: accent,
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
