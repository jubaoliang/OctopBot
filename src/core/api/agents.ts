import type { HttpClient } from './http';
import type { AgentStatus, AgentSummary } from './types';

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
