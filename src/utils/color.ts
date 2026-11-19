/**
 * `#RGB` / `#RRGGBB` color at the given alpha as an `rgba()` string, or null
 * when the input is not a hex color. Server-supplied brand colors go through
 * this so a malformed value falls back to theme tokens instead of rendering
 * `rgba(NaN, …)`.
 */
export function tintHex(color: string | null | undefined, alpha: number): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color?.trim() ?? '');
  if (!match) {
    return null;
  }
  const hex =
    match[1].length === 3
      ? match[1]
          .split('')
          .map(c => c + c)
          .join('')
      : match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * True when a `#RGB` / `#RRGGBB` color is light enough that dark text or a
 * dark glyph reads on it. Uses the WCAG relative-luminance formula, so the
 * threshold matches how contrast is actually measured rather than a naive
 * channel average. Non-hex input returns false (callers then use the light
 * foreground, which is the safer default on a saturated brand color).
 */
export function isLightColor(color: string | null | undefined): boolean {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color?.trim() ?? '');
  if (!match) {
    return false;
  }
  const hex =
    match[1].length === 3
      ? match[1]
          .split('')
          .map(c => c + c)
          .join('')
      : match[1];
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.5;
}
