import { balanceStreamingMarkdown } from '../streaming-markdown';

describe('balanceStreamingMarkdown', () => {
  it('closes an unclosed bold span', () => {
    expect(balanceStreamingMarkdown('这是**加粗到一半')).toBe('这是**加粗到一半**');
  });

  it('closes an unclosed inline code span', () => {
    expect(balanceStreamingMarkdown('运行 `npm insta')).toBe('运行 `npm insta`');
  });

  it('closes an unclosed code fence', () => {
    expect(balanceStreamingMarkdown('代码：\n```\nconst x = 1;')).toBe(
      '代码：\n```\nconst x = 1;\n```',
    );
  });

  it('leaves balanced markdown untouched', () => {
    const src = '**完整** 且 `均衡` 的文本';
    expect(balanceStreamingMarkdown(src)).toBe(src);
  });

  it('balances emphasis outside code fences only', () => {
    // 3 `**` total → odd; a closer is appended at the end, pairs balance.
    const src = '前**半\n```\ncode with ` tick\n```\n尾部**完整';
    const out = balanceStreamingMarkdown(src);
    expect(out.startsWith('前**半')).toBe(true);
    expect((out.match(/\*\*/g) ?? []).length % 2).toBe(0);
    // The backtick inside the fence is not treated as an inline span.
    expect(out).toContain('code with ` tick');
  });
});
