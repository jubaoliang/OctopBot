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
  // Never retain embedded credentials — they would be persisted/redisplayed.
  url.username = '';
  url.password = '';
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

/** Scheme + host + port identity used for per-origin cleartext acknowledgments. */
export function cleartextOrigin(baseUrl: string): string {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.host}`;
}

/** Secure-storage key for a cleartext acknowledgment of one origin. */
export function cleartextAckStorageKey(baseUrl: string): string {
  // expo-secure-store only accepts [A-Za-z0-9._-].
  const origin = cleartextOrigin(baseUrl).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `octop.cleartextAck.${origin}`;
}
