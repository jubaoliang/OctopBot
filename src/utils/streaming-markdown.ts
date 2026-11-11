/**
 * Streaming markdown softening: while a turn is mid-stream, fences and
 * emphasis markers are often unclosed, which markdown renderers draw as
 * literal asterisks/backticks. This appends the missing closers so the
 * partial text still renders as intended.
 */

export function balanceStreamingMarkdown(source: string): string {
  let out = source;

  // Unclosed code fence — close it so the tail renders as a code block.
  const fences = countOccurrences(out, /```/g);
  if (fences % 2 === 1) {
    out += '\n```';
  }

  // Balance inline markers outside code spans: strip fenced blocks first,
  // balance the remainder, then reassemble.
  const segments = out.split('```');
  for (let i = 0; i < segments.length; i += 2) {
    segments[i] = balanceEmphasis(segments[i]);
  }
  out = segments.join('```');

  return out;
}

function balanceEmphasis(text: string): string {
  let out = text;
  for (const marker of ['**', '*', '`']) {
    const n = countOccurrences(
      out,
      new RegExp(
        marker.replace(/[*`]/g, m => `\\${m}`),
        'g',
      ),
    );
    if (n % 2 === 1) {
      out += marker;
    }
  }
  return out;
}

function countOccurrences(text: string, pattern: RegExp): number {
  const matches = text.match(new RegExp(pattern.source, pattern.flags));
  return matches ? matches.length : 0;
}
