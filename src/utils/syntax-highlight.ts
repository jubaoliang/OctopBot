/**
 * Pure-TS syntax highlighting for chat fences.
 *
 * highlight.js emits HTML; we flatten nested spans into `{text, role}` so
 * React Native can color nested Text without a WebView. Colors stay out of
 * this module — callers map `SyntaxRole` through theme tokens.
 */

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

export type SyntaxRole =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'title'
  | 'attr'
  | 'built_in'
  | 'literal'
  | 'meta'
  | 'punctuation'
  | 'addition'
  | 'deletion';

export interface SyntaxSpan {
  text: string;
  role: SyntaxRole;
}

let registered = false;

function ensureLanguages(): void {
  if (registered) {
    return;
  }
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('shell', bash);
  hljs.registerLanguage('sh', bash);
  hljs.registerLanguage('cpp', cpp);
  hljs.registerLanguage('c', cpp);
  hljs.registerLanguage('csharp', csharp);
  hljs.registerLanguage('cs', csharp);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('go', go);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('js', javascript);
  hljs.registerLanguage('jsx', javascript);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('kotlin', kotlin);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerLanguage('md', markdown);
  hljs.registerLanguage('php', php);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('py', python);
  hljs.registerLanguage('ruby', ruby);
  hljs.registerLanguage('rust', rust);
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('swift', swift);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('ts', typescript);
  hljs.registerLanguage('tsx', typescript);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('html', xml);
  hljs.registerLanguage('yaml', yaml);
  hljs.registerLanguage('yml', yaml);
  registered = true;
}

/** Aliases the fence language tag to a registered highlight.js grammar. */
export function resolveLanguage(language: string | undefined): string | null {
  if (!language) {
    return null;
  }
  const raw = language.trim().toLowerCase();
  if (!raw || raw === 'plaintext' || raw === 'text') {
    return null;
  }
  const aliases: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    md: 'markdown',
    html: 'xml',
    c: 'cpp',
    cs: 'csharp',
  };
  return aliases[raw] ?? raw;
}

/**
 * Tokenizes `code` into flat spans. Explicit plain / unknown tags stay
 * uncolored; only a resolved grammar is highlighted.
 */
export function highlightToSpans(code: string, language?: string): SyntaxSpan[] {
  const body = code.replace(/\n$/, '');
  if (!body) {
    return [];
  }
  ensureLanguages();
  try {
    const lang = resolveLanguage(language);
    const grammar = lang ? hljs.getLanguage(lang) : null;
    if (!grammar) {
      return [{ text: body, role: 'plain' }];
    }
    const result = hljs.highlight(body, { language: lang!, ignoreIllegals: true });
    const spans = htmlToSpans(result.value);
    return spans.length > 0 ? spans : [{ text: body, role: 'plain' }];
  } catch {
    return [{ text: body, role: 'plain' }];
  }
}

/** Walks highlight.js HTML into a flat span list (handles nested spans). */
export function htmlToSpans(html: string): SyntaxSpan[] {
  const spans: SyntaxSpan[] = [];
  const roleStack: SyntaxRole[] = ['plain'];
  const re = /<span class="([^"]*)">|<\/span>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[1] !== undefined) {
      roleStack.push(roleFromClassNames(match[1]));
      continue;
    }
    if (match[0] === '</span>') {
      if (roleStack.length > 1) {
        roleStack.pop();
      }
      continue;
    }
    if (match[2]) {
      spans.push({
        text: decodeEntities(match[2]),
        role: roleStack[roleStack.length - 1] ?? 'plain',
      });
    }
  }
  return spans;
}

function roleFromClassNames(classNames: string): SyntaxRole {
  const names = classNames.split(/\s+/).filter(Boolean);
  for (const name of names) {
    const bare = name.startsWith('hljs-') ? name.slice(5) : name;
    const mapped = CLASS_TO_ROLE[bare] ?? CLASS_TO_ROLE[name];
    if (mapped) {
      return mapped;
    }
  }
  return 'plain';
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const CLASS_TO_ROLE: Record<string, SyntaxRole> = {
  keyword: 'keyword',
  string: 'string',
  number: 'number',
  comment: 'comment',
  title: 'title',
  'title function_': 'title',
  function_: 'title',
  attr: 'attr',
  attribute: 'attr',
  built_in: 'built_in',
  literal: 'literal',
  meta: 'meta',
  params: 'punctuation',
  punctuation: 'punctuation',
  operator: 'punctuation',
  subst: 'plain',
  variable: 'attr',
  type: 'built_in',
  class: 'title',
  name: 'title',
  tag: 'keyword',
  'selector-tag': 'keyword',
  addition: 'addition',
  deletion: 'deletion',
  regexp: 'string',
  symbol: 'literal',
  'template-variable': 'attr',
  'template-tag': 'keyword',
};
