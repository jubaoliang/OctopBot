import { highlightToSpans, htmlToSpans, resolveLanguage } from '../syntax-highlight';

describe('resolveLanguage', () => {
  it('maps common aliases', () => {
    expect(resolveLanguage('py')).toBe('python');
    expect(resolveLanguage('JS')).toBe('javascript');
    expect(resolveLanguage('ts')).toBe('typescript');
    expect(resolveLanguage('shell')).toBe('bash');
  });

  it('returns null for empty tags', () => {
    expect(resolveLanguage(undefined)).toBeNull();
    expect(resolveLanguage('  ')).toBeNull();
    expect(resolveLanguage('plaintext')).toBeNull();
  });
});

describe('htmlToSpans', () => {
  it('flattens nested highlight.js spans', () => {
    const spans = htmlToSpans(
      '<span class="hljs-keyword">def</span> <span class="hljs-title">f</span>()',
    );
    expect(spans).toEqual([
      { text: 'def', role: 'keyword' },
      { text: ' ', role: 'plain' },
      { text: 'f', role: 'title' },
      { text: '()', role: 'plain' },
    ]);
  });
});

describe('highlightToSpans', () => {
  it('colors python keywords and strings', () => {
    const spans = highlightToSpans('def printhello():\n    print("hello")\n', 'python');
    const joined = spans.map(s => s.text).join('');
    expect(joined).toContain('def');
    expect(joined).toContain('"hello"');
    expect(spans.some(s => s.role === 'keyword' && s.text.includes('def'))).toBe(true);
    expect(spans.some(s => s.role === 'string' && s.text.includes('hello'))).toBe(true);
  });

  it('falls back to a plain span for empty input', () => {
    expect(highlightToSpans('')).toEqual([]);
    expect(highlightToSpans('\n')).toEqual([]);
  });

  it('still returns text when the language is unknown', () => {
    const spans = highlightToSpans('hello = 1', 'not-a-real-lang-xyz');
    expect(spans.map(s => s.text).join('')).toBe('hello = 1');
  });
});
