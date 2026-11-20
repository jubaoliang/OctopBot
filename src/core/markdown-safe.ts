/**
 * One-line markdown-safe text for device-sourced strings (contact names,
 * event titles, locations). They are attacker-influenceable (vCards,
 * calendar invites) and land in a markdown document the server-side agent
 * reads, so they must not forge headings, links or other structure.
 *
 * Newlines collapse; the characters that can start or wrap markdown
 * structure (`#` headings, `>` quotes, `*` emphasis, backticks, link and
 * image brackets, HTML-ish `<`) are escaped. Plain punctuation inside a
 * line (`-`, `_`, parens) is harmless there and left readable.
 */
export function safeLine(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\\`*#>[\]<]/g, match => `\\${match}`)
    .trim();
}
