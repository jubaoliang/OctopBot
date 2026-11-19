import type { AgentSummary } from '@/core/api/types';

import { filterAgents } from '../filter-agents';

function agent(overrides: Partial<AgentSummary> & { name: string }): AgentSummary {
  return {
    id: overrides.name,
    agent_id: overrides.agent_id ?? overrides.name.toLowerCase(),
    description: null,
    kind: 'expert',
    state: 'idle',
    default_model: null,
    icon_name: null,
    icon_url: null,
    color: null,
    welcome_message: null,
    is_shared: false,
    owner_username: null,
    unread_count: 0,
    ...overrides,
  };
}

const roster = [
  agent({ name: 'Ops Bot', description: 'Container and disk diagnostics' }),
  agent({ name: 'Docs Helper', description: 'Writes 运维 scripts' }),
  agent({ name: 'Analyst', agent_id: 'data-analyst', description: null }),
];

describe('filterAgents', () => {
  it('returns the roster untouched for an empty or blank query', () => {
    expect(filterAgents(roster, '')).toBe(roster);
    expect(filterAgents(roster, '   ')).toBe(roster);
  });

  it('matches the name case-insensitively', () => {
    expect(filterAgents(roster, 'ops').map(a => a.name)).toEqual(['Ops Bot']);
    expect(filterAgents(roster, 'ANALYST').map(a => a.name)).toEqual(['Analyst']);
  });

  it('matches the description, including non-Latin text', () => {
    expect(filterAgents(roster, 'disk').map(a => a.name)).toEqual(['Ops Bot']);
    expect(filterAgents(roster, '运维').map(a => a.name)).toEqual(['Docs Helper']);
  });

  it('matches the agent id when the name says nothing', () => {
    expect(filterAgents(roster, 'data-').map(a => a.name)).toEqual(['Analyst']);
  });

  it('does not match a null description', () => {
    expect(filterAgents(roster, 'null')).toEqual([]);
  });
});
