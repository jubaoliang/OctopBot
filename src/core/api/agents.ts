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
}
