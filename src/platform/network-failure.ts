/**
 * Why a fetch failed, in terms a person can act on.
 *
 * - `cors`: the host answered, but the browser refused to hand the response
 *   over because the server sends no `Access-Control-Allow-Origin`. Only a
 *   browser can produce this.
 * - `offline`: the device has no network at all.
 * - `unreachable`: the request never completed — wrong address, refused
 *   connection, TLS failure, or a server that is down.
 */
export type NetworkFailure = 'cors' | 'offline' | 'unreachable';

/**
 * Native transports are not subject to CORS, so a failed fetch is a failed
 * connection. The web build overrides this file (`network-failure.web.ts`)
 * with a probe that tells the three cases apart.
 */
export async function classifyFetchFailure(_url: string): Promise<NetworkFailure> {
  return 'unreachable';
}
