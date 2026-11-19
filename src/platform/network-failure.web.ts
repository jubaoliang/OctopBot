import type { NetworkFailure } from './network-failure';

/**
 * Distinguishes the three ways a fetch can fail in a browser.
 *
 * A CORS failure and a dead host both surface as an opaque `TypeError`, so
 * the only way to tell them apart is to ask the host again in a mode that
 * ignores CORS: an opaque `no-cors` request that *resolves* proves the server
 * is up and answering — the browser simply would not show us the response.
 * If that probe also throws, the connection itself is the problem.
 */
export async function classifyFetchFailure(url: string): Promise<NetworkFailure> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }
  if (typeof fetch !== 'function') {
    return 'unreachable';
  }
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' });
    return 'cors';
  } catch {
    return 'unreachable';
  }
}
