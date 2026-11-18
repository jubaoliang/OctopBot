import type { AgentSummary } from '@/core/api/types';

/**
 * Filter an expert roster by a free-text query. Pure, so it runs in the
 * tab's search field on every keystroke (search-fields.md: start search as
 * soon as a person types) instead of waiting for a submit.
 *
 * Matches name, description and machine id, case-insensitively; an empty
 * query returns the roster untouched.
 */
export function filterAgents(agents: AgentSummary[], query: string): AgentSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return agents;
  }
  return agents.filter(agent => {
    const haystack = [agent.name, agent.description, agent.agent_id]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}
