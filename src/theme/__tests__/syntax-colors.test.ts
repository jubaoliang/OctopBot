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
  it('uses danger/success for semantic roles in both modes', () => {
    const light = resolveSyntaxColors(lightTokens, 'light');
    const dark = resolveSyntaxColors(darkTokens, 'dark');
    expect(light.keyword).toBe(lightTokens.danger);
    expect(light.string).toBe(lightTokens.success);
    expect(dark.keyword).toBe(darkTokens.danger);
    expect(dark.deletion).toBe(darkTokens.danger);
  });

  it('follows a chromatic palette accent for identity roles', () => {
    const tokens = resolveTokens('light', 'violet');
    const colors = resolveSyntaxColors(tokens, 'light');
    expect(colors.built_in).toBe(tokens.accent);
    expect(colors.number).toBe(tokens.accent);
    expect(colors.title).toBe(tokens.accent);
  });

  it('does not use ink accent for identity roles', () => {
    const tokens = resolveTokens('light', 'ink');
    const colors = resolveSyntaxColors(tokens, 'light');
    expect(colors.built_in).not.toBe(tokens.accent);
    expect(colors.built_in).toBe('#2F82D1');
    expect(isNearGray(colors.built_in)).toBe(false);
  });

  it('keeps comments on tertiary text', () => {
    const colors = resolveSyntaxColors(resolveTokens('dark', 'emerald'), 'dark');
    expect(colors.comment).toBe(darkTokens.textTertiary);
  });
});
