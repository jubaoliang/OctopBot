import type { HttpClient } from './http';
import type { UsageGranularity, UsageSummary, UsageWindow } from './types';

export interface UsageQuery {
  /** Defaults to the server default, `last_30d`. */
  window?: UsageWindow;
  /** Defaults to the server default, `by_day`. */
  granularity?: UsageGranularity;
  /** Narrow the roll-up to one expert the caller can see. */
  agentId?: string;
}

/**
 * Token usage ledger (docs/api-contract.md, "Token usage"). Only the
 * caller's own roll-up is exposed here; the admin-wide endpoints and the
 * Excel export are out of scope for the mobile client.
 */
export class UsageApi {
  constructor(private readonly http: HttpClient) {}

  summary(query: UsageQuery = {}): Promise<UsageSummary> {
    const params = [
      `window=${encodeURIComponent(query.window ?? 'last_30d')}`,
      `granularity=${encodeURIComponent(query.granularity ?? 'by_day')}`,
    ];
    if (query.agentId) {
      params.push(`agent_id=${encodeURIComponent(query.agentId)}`);
    }
    return this.http.get(`/api/usage/summary?${params.join('&')}`);
  }
}
