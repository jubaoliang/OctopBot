/** Normalizes a user-entered Octop server base URL. Pure, no side effects. */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('empty URL');
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`invalid URL: ${input}`);
  }
  if (!url.hostname || url.hostname === 'https:' || url.hostname.includes(' ')) {
    throw new Error(`invalid URL: ${input}`);
  }
  // Users often paste `http://host:8088/dashboard`; keep origin only —
  // every API path in the contract is relative to the server root.
  url.pathname = '';
  url.search = '';
  url.hash = '';
  let out = url.toString();
  if (out.endsWith('/')) {
    out = out.slice(0, -1);
  }
  return out;
}

/** True when the URL is plain HTTP — callers surface a cleartext warning once. */
export function isCleartext(baseUrl: string): boolean {
  return baseUrl.startsWith('http://');
}
