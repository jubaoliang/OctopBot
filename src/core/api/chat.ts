import type { HttpClient } from './http';
import type { ServerFrame } from './types';

export type HitlDecision =
  { type: 'approve' } | { type: 'reject'; message?: string } | { type: 'respond'; message: string };

export interface HitlResumeBody {
  thread_id: string;
  decisions: HitlDecision[];
  pending_id?: string;
}

/**
 * HITL resume over SSE (`POST …/chat/hitl/resume`). Frames mirror the chat
 * WebSocket; the caller folds them into the same turn reducer.
 *
 * The body is read as text (not streamed) so this stays compatible with
 * React Native's fetch, which does not always expose ReadableStream.
 */
export class ChatApi {
  constructor(private readonly http: HttpClient) {}

  async resumeHitl(
    agentId: string,
    body: HitlResumeBody,
    onFrame: (frame: ServerFrame) => void,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const response = await this.http.requestRaw(`/api/agents/${agentId}/chat/hitl/resume`, {
      method: 'POST',
      body,
      signal: options.signal,
    });
    const text = await response.text();
    // Accept both LF and CRLF event framing (sse-starlette uses CRLF).
    for (const part of text.split(/\r?\n\r?\n+/)) {
      const dataLine = part
        .split(/\r?\n/)
        .map(line => line.trimEnd())
        .find(line => line.startsWith('data:'));
      if (!dataLine) {
        continue;
      }
      const raw = dataLine.slice('data:'.length).trim();
      if (!raw || raw === '[DONE]') {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        // Malformed chunk — skip; later events may still complete the turn.
        continue;
      }
      if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
        onFrame(parsed as ServerFrame);
      }
    }
  }
}
