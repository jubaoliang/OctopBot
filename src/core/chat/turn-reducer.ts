/**
 * Pure chat-turn fold: history, live frames, send/stop/HITL busy state.
 * The screen owns timers, sockets, and HTTP; this module owns transcript truth.
 */

import type { ServerFrame, TurnAttachment } from '../api/types';
import {
  applyProcessFrame,
  emptyProcessCounts,
  type CountableFrame,
  type ProcessCountState,
} from './process-counts';

export type ChatTurn =
  | { kind: 'user'; id: string; text: string; attachments?: TurnAttachment[] }
  | { kind: 'assistant'; id: string; text: string }
  | {
      kind: 'error';
      id: string;
      text: string;
      retryText?: string;
      retryAttachments?: TurnAttachment[];
    }
  | { kind: 'hitl'; id: string; pendingId: string; summary: string; detail?: string };

export interface HitlPending {
  pendingId: string;
  summary: string;
  detail?: string;
}

export interface ChatTurnState {
  threadId: string | null;
  turns: ChatTurn[];
  /** True while tokens are flowing or a turn is active. */
  streaming: boolean;
  /** Composer blocked: streaming, stop waiting for terminal, or HITL. */
  busy: boolean;
  hitl: HitlPending | null;
  process: ProcessCountState;
  stopRequested: boolean;
  /** Monotonic id seed for local turn keys. */
  idSeq: number;
}

export type ChatTurnAction =
  | { type: 'reset' }
  | { type: 'threadReady'; threadId: string }
  | {
      type: 'historyLoaded';
      threadId: string;
      turns: ChatTurn[];
      hitl?: HitlPending | null;
      process?: ProcessCountState;
    }
  | {
      type: 'userSend';
      text: string;
      attachments?: TurnAttachment[];
    }
  | {
      type: 'sendFailed';
      retryText: string;
      message: string;
      retryAttachments?: TurnAttachment[];
    }
  | { type: 'clearRetry'; retryText: string }
  | { type: 'stopRequested' }
  | { type: 'stopTimedOut'; message: string }
  | { type: 'flushTokens'; delta: string }
  | {
      type: 'frame';
      frame: ServerFrame;
      defaults: { hitlTitle: string; sendFailed: string };
    }
  | { type: 'hitlDecide' }
  | { type: 'hitlFailed'; message: string };

export function initialChatTurnState(): ChatTurnState {
  return {
    threadId: null,
    turns: [],
    streaming: false,
    busy: false,
    hitl: null,
    process: emptyProcessCounts(),
    stopRequested: false,
    idSeq: 0,
  };
}

function nextId(state: ChatTurnState, prefix: string): { id: string; idSeq: number } {
  const idSeq = state.idSeq + 1;
  return { id: `${prefix}-${idSeq}`, idSeq };
}

function frameThreadId(frame: ServerFrame): string | undefined {
  if (typeof frame !== 'object' || frame === null) {
    return undefined;
  }
  const value = (frame as { thread_id?: unknown }).thread_id;
  return typeof value === 'string' ? value : undefined;
}

function isCountable(frame: ServerFrame): CountableFrame | null {
  switch (frame.type) {
    case 'reasoning':
    case 'token':
    case 'tool_result':
    case 'turn.started':
    case 'turn.ended':
    case 'done':
      return { type: frame.type };
    case 'tool_call_chunk': {
      const index = (frame as { index?: unknown }).index;
      return typeof index === 'number' ? { type: 'tool_call_chunk', index } : null;
    }
    default:
      return null;
  }
}

function appendAssistant(
  turns: ChatTurn[],
  idSeq: number,
  delta: string,
): {
  turns: ChatTurn[];
  idSeq: number;
} {
  if (turns.length === 0 || turns[turns.length - 1].kind !== 'assistant') {
    const next = nextId({ idSeq } as ChatTurnState, 'a');
    return {
      turns: [...turns, { kind: 'assistant', id: next.id, text: delta }],
      idSeq: next.idSeq,
    };
  }
  const copy = turns.slice();
  const last = copy[copy.length - 1];
  if (last.kind !== 'assistant') {
    const next = nextId({ idSeq } as ChatTurnState, 'a');
    return {
      turns: [...turns, { kind: 'assistant', id: next.id, text: delta }],
      idSeq: next.idSeq,
    };
  }
  copy[copy.length - 1] = { ...last, text: last.text + delta };
  return { turns: copy, idSeq };
}

function clearBusy(state: ChatTurnState): ChatTurnState {
  return {
    ...state,
    streaming: false,
    busy: state.hitl !== null,
    stopRequested: false,
  };
}

function hitlSummary(
  request: { pending_id: string; [key: string]: unknown },
  fallback: string,
): { summary: string; detail?: string } {
  let summary = fallback;
  if (typeof request.message === 'string' && request.message.trim()) {
    summary = request.message;
  } else if (typeof request.description === 'string' && request.description.trim()) {
    summary = request.description;
  }
  const detailParts: string[] = [];
  if (typeof request.tool === 'string' && request.tool.trim()) {
    detailParts.push(request.tool);
  } else if (typeof request.name === 'string' && request.name.trim()) {
    detailParts.push(request.name);
  }
  if (typeof request.action === 'string' && request.action.trim()) {
    detailParts.push(request.action);
  }
  const args = request.arguments ?? request.args;
  if (args !== undefined) {
    try {
      const rendered = typeof args === 'string' ? args : JSON.stringify(args, null, 2);
      if (rendered && rendered !== '{}' && rendered !== 'null') {
        detailParts.push(rendered);
      }
    } catch {
      // ignore non-serializable payloads
    }
  }
  const detail = detailParts.length > 0 ? detailParts.join('\n') : undefined;
  return { summary, detail };
}

function turnDedupeKey(turn: ChatTurn): string {
  // Prefer stable ids; fall back to kind+text for history rows without live ids.
  return `id:${turn.id}`;
}

function turnContentKey(turn: ChatTurn): string {
  if (turn.kind === 'hitl') {
    return `hitl:${turn.pendingId}`;
  }
  if (turn.kind === 'user') {
    const files = (turn.attachments ?? []).map(a => a.workspace_path).join(',');
    return `user:${turn.text}:${files}`;
  }
  return `${turn.kind}:${turn.text}`;
}

/** Merge history snapshot with any live turns already present for the same thread. */
export function mergeHistoryTurns(existing: ChatTurn[], history: ChatTurn[]): ChatTurn[] {
  if (existing.length === 0) {
    return history;
  }
  const seenIds = new Set(history.map(turnDedupeKey));
  const seenContent = new Set(history.map(turnContentKey));
  const extras = existing.filter(
    t => !seenIds.has(turnDedupeKey(t)) && !seenContent.has(turnContentKey(t)),
  );
  return extras.length === 0 ? history : [...history, ...extras];
}

export function reduceChatTurn(state: ChatTurnState, action: ChatTurnAction): ChatTurnState {
  switch (action.type) {
    case 'reset':
      return initialChatTurnState();

    case 'threadReady':
      if (state.threadId === action.threadId) {
        return state;
      }
      return { ...state, threadId: action.threadId };

    case 'historyLoaded': {
      if (state.threadId && state.threadId !== action.threadId) {
        // Stale history for a previous thread — ignore.
        return state;
      }
      const merged = mergeHistoryTurns(
        state.threadId === action.threadId ? state.turns : [],
        action.turns,
      );
      const process = action.process ?? emptyProcessCounts();
      const hitl = action.hitl === undefined ? state.hitl : action.hitl;
      // Preserve an in-flight live turn; history must not unlock the composer mid-stream.
      const liveBusy = state.streaming || state.stopRequested || state.busy;
      return {
        ...state,
        threadId: action.threadId,
        turns: merged,
        hitl,
        process,
        streaming: liveBusy ? state.streaming : false,
        busy: liveBusy || hitl !== null,
        stopRequested: liveBusy ? state.stopRequested : false,
      };
    }

    case 'userSend': {
      const { id, idSeq } = nextId(state, 'u');
      return {
        ...state,
        idSeq,
        turns: [
          ...state.turns,
          {
            kind: 'user',
            id,
            text: action.text,
            attachments: action.attachments,
          },
        ],
        streaming: true,
        busy: true,
        hitl: null,
        stopRequested: false,
      };
    }

    case 'sendFailed': {
      const { id, idSeq } = nextId(state, 'e');
      return clearBusy({
        ...state,
        idSeq,
        turns: [
          ...state.turns,
          {
            kind: 'error',
            id,
            text: action.message,
            retryText: action.retryText,
            retryAttachments: action.retryAttachments,
          },
        ],
      });
    }

    case 'clearRetry':
      return {
        ...state,
        turns: state.turns.filter(t => !(t.kind === 'error' && t.retryText === action.retryText)),
      };

    case 'stopRequested':
      return { ...state, stopRequested: true, busy: true };

    case 'stopTimedOut': {
      const { id, idSeq } = nextId(state, 'e');
      return clearBusy({
        ...state,
        idSeq,
        turns: [...state.turns, { kind: 'error', id, text: action.message }],
      });
    }

    case 'flushTokens': {
      if (!action.delta) {
        return state;
      }
      const appended = appendAssistant(state.turns, state.idSeq, action.delta);
      return {
        ...state,
        turns: appended.turns,
        idSeq: appended.idSeq,
        streaming: true,
        busy: true,
      };
    }

    case 'hitlDecide':
      return {
        ...state,
        hitl: null,
        turns: state.turns.filter(t => t.kind !== 'hitl'),
        streaming: true,
        busy: true,
      };

    case 'hitlFailed': {
      const { id, idSeq } = nextId(state, 'e');
      return clearBusy({
        ...state,
        idSeq,
        turns: [...state.turns, { kind: 'error', id, text: action.message }],
      });
    }

    case 'frame': {
      const tid = frameThreadId(action.frame);
      if (tid && state.threadId && tid !== state.threadId) {
        return state;
      }

      let next = state;
      const countable = isCountable(action.frame);
      if (countable) {
        const process = applyProcessFrame(next.process, countable);
        next = { ...next, process };
      }

      switch (action.frame.type) {
        case 'token': {
          const delta = (action.frame as { content?: unknown }).content;
          if (typeof delta !== 'string' || !delta) {
            return next;
          }
          // Tokens flush through the screen timer via flushTokens; mark busy only.
          return { ...next, streaming: true, busy: true };
        }
        case 'turn.started':
        case 'turn.resumed':
          return {
            ...next,
            streaming: true,
            busy: true,
            hitl: null,
            turns: next.turns.filter(t => t.kind !== 'hitl'),
            stopRequested: false,
          };
        case 'turn_status': {
          const active = (action.frame as { active?: unknown }).active === true;
          return {
            ...next,
            streaming: active,
            busy: active || next.hitl !== null,
            stopRequested: active ? next.stopRequested : false,
          };
        }
        case 'turn.ended':
        case 'done':
          return clearBusy(next);
        case 'error': {
          const message = (action.frame as { message?: unknown }).message;
          const { id, idSeq } = nextId(next, 'e');
          return clearBusy({
            ...next,
            idSeq,
            hitl: null,
            turns: [
              ...next.turns.filter(t => t.kind !== 'hitl'),
              {
                kind: 'error',
                id,
                text: typeof message === 'string' ? message : action.defaults.sendFailed,
              },
            ],
          });
        }
        case 'hitl_required': {
          const request = (
            action.frame as { request?: { pending_id?: unknown; [key: string]: unknown } }
          ).request;
          const pendingId =
            request && typeof request.pending_id === 'string' ? request.pending_id : null;
          if (!pendingId || !request) {
            // Fail closed — no actionable pending id.
            return clearBusy(next);
          }
          const { summary, detail } = hitlSummary(
            request as { pending_id: string; [key: string]: unknown },
            action.defaults.hitlTitle,
          );
          const { id, idSeq } = nextId(next, 'h');
          const hitl: HitlPending = { pendingId, summary, detail };
          return {
            ...next,
            idSeq,
            streaming: false,
            busy: true,
            stopRequested: false,
            hitl,
            turns: [
              ...next.turns.filter(t => t.kind !== 'hitl'),
              { kind: 'hitl', id, pendingId, summary, detail },
            ],
          };
        }
        case 'user': {
          // Echo — skip if we already appended the local user turn.
          const content = (action.frame as { content?: unknown }).content;
          if (typeof content !== 'string' || !content) {
            return next;
          }
          const last = next.turns[next.turns.length - 1];
          if (last?.kind === 'user' && last.text === content) {
            return next;
          }
          const { id, idSeq } = nextId(next, 'u');
          return {
            ...next,
            idSeq,
            turns: [...next.turns, { kind: 'user', id, text: content }],
          };
        }
        default:
          return next;
      }
    }

    default:
      return state;
  }
}
