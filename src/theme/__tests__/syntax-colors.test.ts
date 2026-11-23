import { darkTokens, lightTokens } from '../tokens';
import { isNearGray, resolveSyntaxColors } from '../syntax-colors';
import { resolveTokens } from '../palettes';

describe('isNearGray', () => {
  it('detects ink-like accents', () => {
    expect(isNearGray('#111827')).toBe(true);
    expect(isNearGray('#F3F4F6')).toBe(true);
    expect(isNearGray('#000000')).toBe(true);
  });

  it('rejects chromatic accents', () => {
    expect(isNearGray('#2F82D1')).toBe(false);
    expect(isNearGray('#D64570')).toBe(false);
  });
});

describe('resolveSyntaxColors', () => {
  it('uses fixed calm hues for keywords and function names', () => {
    const light = resolveSyntaxColors(lightTokens, 'light');
    const dark = resolveSyntaxColors(darkTokens, 'dark');
    expect(light.keyword).toBe('#0064D8');
    expect(dark.keyword).toBe('#7EB6FF');
    expect(light.title).toBe('#C2185B');
    expect(dark.title).toBe('#F48FB1');
  });

  it('uses danger/success only for diff semantics', () => {
    const light = resolveSyntaxColors(lightTokens, 'light');
    expect(light.string).toBe(lightTokens.success);
    expect(light.addition).toBe(lightTokens.success);
    expect(light.deletion).toBe(lightTokens.danger);
  });

  it('follows a chromatic palette accent for numeric roles', () => {
    const tokens = resolveTokens('light', 'violet');
    const colors = resolveSyntaxColors(tokens, 'light');
    expect(colors.built_in).toBe(tokens.accent);
    expect(colors.number).toBe(tokens.accent);
    expect(colors.literal).toBe(tokens.accent);
  });

  it('swaps the ink accent for purple numerals', () => {
    const tokens = resolveTokens('light', 'ink');
    const colors = resolveSyntaxColors(tokens, 'light');
    expect(colors.built_in).not.toBe(tokens.accent);
    expect(colors.built_in).toBe('#7048E8');
    expect(isNearGray(colors.built_in)).toBe(false);
  });

  it('keeps comments on tertiary text', () => {
    const colors = resolveSyntaxColors(resolveTokens('dark', 'emerald'), 'dark');
    expect(colors.comment).toBe(darkTokens.textTertiary);
  });
});
