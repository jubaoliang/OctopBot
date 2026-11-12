import type { HttpClient } from './http';
import type {
  ContentBlock,
  ConversationMode,
  HistoryPage,
  ReasoningMode,
  ThreadSummary,
  TurnAttachment,
} from './types';

export interface HistoryQuery {
  limit?: number;
  cursor?: string;
}

export interface ThreadUpdate {
  title?: string;
  pinned?: boolean;
  model_ref?: string;
  reasoning_mode?: ReasoningMode;
  conversation_mode?: ConversationMode;
}

/** New-thread marker returned by create(). */
export interface CreatedThread {
  thread_id: string;
  session_key: string;
}

/** Locally composed outgoing message (text plus optional uploaded attachments). */
export interface OutgoingMessage {
  text: string;
  attachments?: TurnAttachment[];
}

export interface SendOptions {
  model?: string;
  conversation_mode?: ConversationMode;
  knowledge_base_ids?: string[];
  delivery?: 'auto' | 'steer' | 'follow_up';
  client_pending_id?: string;
  expected_turn_id?: string;
}

/** Normalized user/assistant exchange used by the UI layer. */
export interface ComposedTurn {
  text: string;
  attachments: OutgoingMessage['attachments'];
}

export function composeUserTurn(message: OutgoingMessage): ComposedTurn {
  return { text: message.text, attachments: message.attachments ?? [] };
}

/** Extracts the readable text blocks from a history message (drops thinking/tool blocks). */
export function readableText(content: ContentBlock[]): string {
  return content
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('');
}

/** Tallies thinking / tool_use blocks across a history page for the process card. */
export function processCountsFromHistory(messages: { content: ContentBlock[] }[]): {
  tools: number;
  thinking: number;
} {
  let tools = 0;
  let thinking = 0;
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'tool_use') {
        tools += 1;
      } else if (block.type === 'thinking') {
        thinking += 1;
      }
    }
  }
  return { tools, thinking };
}

export class ThreadsApi {
  constructor(private readonly http: HttpClient) {}

  list(agentId: string, limit = 50): Promise<ThreadSummary[]> {
    return this.http.get(`/api/agents/${agentId}/threads?limit=${limit}`);
  }

  create(agentId: string): Promise<CreatedThread> {
    return this.http.post(`/api/agents/${agentId}/threads`);
  }

  history(agentId: string, threadId: string, query: HistoryQuery = {}): Promise<HistoryPage> {
    const params = new URLSearchParams();
    if (query.limit !== undefined) {
      params.set('limit', String(query.limit));
    }
    if (query.cursor !== undefined) {
      params.set('cursor', query.cursor);
    }
    const qs = params.toString();
    return this.http.get(`/api/agents/${agentId}/threads/${threadId}/history${qs ? `?${qs}` : ''}`);
  }

  update(agentId: string, threadId: string, patch: ThreadUpdate): Promise<ThreadSummary> {
    return this.http.patch(`/api/agents/${agentId}/threads/${threadId}`, patch);
  }

  remove(agentId: string, threadId: string): Promise<void> {
    // 409 THREAD_TURN_ACTIVE while a turn is streaming — callers surface a retry.
    return this.http.delete(`/api/agents/${agentId}/threads/${threadId}`);
  }

  markRead(agentId: string, threadId: string): Promise<void> {
    return this.http.post(`/api/agents/${agentId}/threads/${threadId}/read`);
  }

  cancel(agentId: string, threadId: string): Promise<{ thread_id: string; cancelled: boolean }> {
    return this.http.post(`/api/agents/${agentId}/threads/${threadId}/cancel`);
  }

  /** DELETE without throwing — cleanup paths tolerate missing threads. */
  async removeQuietly(agentId: string, threadId: string): Promise<void> {
    try {
      await this.http.delete(`/api/agents/${agentId}/threads/${threadId}`);
    } catch {
      // cleanup only
    }
  }
}
