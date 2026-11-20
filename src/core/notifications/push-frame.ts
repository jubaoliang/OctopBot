import type { DashboardPush } from '../api/types';

/**
 * Type-guard a notifications-socket frame into a dashboard push. Unknown or
 * malformed frames return null and are dropped — the socket is
 * forward-compatible, so new server frame types simply fall through.
 */
export function parseDashboardPush(frame: unknown): DashboardPush | null {
  if (typeof frame !== 'object' || frame === null) {
    return null;
  }
  const fields = frame as Record<string, unknown>;
  if (fields.type !== 'dashboard_push') {
    return null;
  }
  if (typeof fields.agent_id !== 'string' || fields.agent_id.length === 0) {
    return null;
  }
  if (typeof fields.text !== 'string') {
    return null;
  }
  return {
    type: 'dashboard_push',
    agent_id: fields.agent_id,
    thread_id: typeof fields.thread_id === 'string' ? fields.thread_id : null,
    text: fields.text,
    agent_name: typeof fields.agent_name === 'string' ? fields.agent_name : null,
  };
}
