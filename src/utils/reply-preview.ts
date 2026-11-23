/**
 * Notification-body preview of a markdown reply: a glance, not the answer.
 * Fenced code and images are dropped, links keep their text, heading/list
 * markers and emphasis go, whitespace collapses, then the result is capped.
 */

const FENCE = /```[\s\S]*?```/g;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
const TABLE_RULE = /^[ \t]*\|?[ \t:|-]*-[ \t:|-]*\|?[ \t]*$/gm;
const LEAD = /^[ \t]*(?:[#>*+-]+|\d+[.)])[ \t]*/gm;
const EMPHASIS = /[*_~`]+/g;
const PIPE = /\|/g;
const WHITESPACE = /\s+/g;

export function replyPreview(markdown: string, max = 160): string {
  const text = markdown
    .replace(FENCE, ' ')
    .replace(IMAGE, ' ')
    .replace(LINK, '$1')
    .replace(TABLE_RULE, ' ')
    .replace(LEAD, '')
    .replace(EMPHASIS, '')
    .replace(PIPE, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
  if (text.length > max) {
    return `${text.slice(0, max - 1).trimEnd()}…`;
  }
  return text;
}
