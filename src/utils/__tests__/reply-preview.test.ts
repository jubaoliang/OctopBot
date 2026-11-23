import { replyPreview } from '../reply-preview';

describe('replyPreview', () => {
  it('strips markdown down to plain glanceable text', () => {
    const markdown = [
      '# Result',
      '',
      '> quoted',
      '',
      '- one',
      '- two',
      '',
      'See [docs](https://x.y/z) and ![pic](https://x.y/p.png).',
      '',
      '```python',
      "print('nope')",
      '```',
      '',
      '| a | b |',
      '|---|---|',
      '| 1 | 2 |',
    ].join('\n');
    expect(replyPreview(markdown)).toBe('Result quoted one two See docs and . a b 1 2');
  });

  it('caps long answers with an ellipsis and never returns brackets', () => {
    const preview = replyPreview(`**${'x'.repeat(400)}**`);
    expect(preview).toHaveLength(160);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview).not.toContain('*');
    expect(replyPreview('```only code```')).toBe('');
  });

  it('keeps ordinary prose intact', () => {
    expect(replyPreview('The answer is 42.')).toBe('The answer is 42.');
  });
});
