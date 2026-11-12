import type { HttpClient } from './http';
import type { AgentStatus, AgentSummary, UploadResult } from './types';

/** RN FormData file part — fetch serializes `{ uri, name, type }` as a blob. */
export interface UploadFilePart {
  uri: string;
  name: string;
  type: string;
}

export type AgentScope = 'mine' | 'all';

export class AgentsApi {
  constructor(private readonly http: HttpClient) {}

  list(scope: AgentScope = 'mine'): Promise<AgentSummary[]> {
    return this.http.get(`/api/agents?scope=${scope}`);
  }

  get(agentId: string): Promise<AgentSummary> {
    return this.http.get(`/api/agents/${agentId}`);
  }

  status(agentId: string): Promise<AgentStatus> {
    return this.http.get(`/api/agents/${agentId}/status`);
  }

  start(agentId: string): Promise<void> {
    return this.http.post(`/api/agents/${agentId}/start`);
  }

  stop(agentId: string): Promise<void> {
    return this.http.post(`/api/agents/${agentId}/stop`);
  }

  markRead(agentId: string): Promise<void> {
    return this.http.post(`/api/agents/${agentId}/read`);
  }

  /** Per-expert welcome payload: greeting + locale-aware quick prompts. */
  welcome(agentId: string): Promise<{
    welcome_message?: { zh?: string; en?: string } | null;
    quick_prompts?: unknown;
  }> {
    return this.http.get(`/api/agents/${agentId}/chat/welcome`);
  }

  /** Uploads a file into the agent workspace `inbound/` (multipart field `file`). */
  upload(
    agentId: string,
    file: UploadFilePart,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<UploadResult> {
    const form = new FormData();
    // React Native's FormData accepts a file descriptor object here.
    form.append('file', file as unknown as Blob);
    return this.http.postForm(`/api/agents/${agentId}/upload`, form, {
      signal: options.signal,
      // Large images on slow uplinks need more than the 60s default.
      timeoutMs: options.timeoutMs ?? 180_000,
    });
  }

  create(body: { name: string; description?: string }): Promise<AgentSummary> {
    return this.http.post('/api/agents', body);
  }

  /** DELETE without throwing — cleanup paths tolerate missing agents. */
  async deleteAgentQuietly(agentId: string): Promise<void> {
    try {
      await this.http.delete(`/api/agents/${agentId}`);
    } catch {
      // cleanup only
    }
  }
}
