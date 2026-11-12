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
