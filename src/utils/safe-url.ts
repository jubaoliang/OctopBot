/**
 * URL helpers for Markdown / deep-link trust boundaries.
 * Pure TypeScript — no react-native imports.
 */

/** True when `url` is an ordinary http(s) web link (no other schemes). */
export function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
