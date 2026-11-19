/**
 * Pure chat-turn fold: history, live frames, send/stop/HITL busy state.
 * The screen owns timers, sockets, and HTTP; this module owns transcript truth.
 */

import type { HitlRequest, ServerFrame, TurnAttachment } from '../api/types';
import {
  applyProcessFrame,
  emptyProcessCounts,
  type CountableFrame,
  type ProcessCountState,
} from './process-counts';
import { appendReasoning, appendToolCall, type ProcessStep } from './process-steps';

export type HitlDecisionType = 'approve' | 'reject' | 'respond';

export interface HitlCardOption {
  label: string;
  description?: string;
  value?: string;
}

export interface HitlCardQuestion {
  question: string;
  options?: HitlCardOption[];
}

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
  | {
      kind: 'hitl';
      id: string;
      pendingId: string;
      summary: string;
      detail?: string;
      actionType?: 'question' | 'approval';
      questions?: HitlCardQuestion[];
      allowedDecisions?: HitlDecisionType[];
    };

export interface HitlPending {
  pendingId: string;
  summary: string;
  detail?: string;
  actionType?: 'question' | 'approval';
  questions?: HitlCardQuestion[];
  allowedDecisions?: HitlDecisionType[];
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
  /** Reasoning / tool trace of the turn on screen, for the expandable card. */
  trace: ProcessStep[];
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
      /** Precomputed trace from the replayed messages; derived when omitted. */
      trace?: ProcessStep[];
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
      defaults: { hitlTitle: string; sendFailed: string; hitlQuestionTitle?: string };
    }
  | { type: 'hitlDecide'; userMessage?: string }
  | { type: 'hitlFailed'; message: string };

export function initialChatTurnState(): ChatTurnState {
  return {
    threadId: null,
    turns: [],
    streaming: false,
    busy: false,
    hitl: null,
    process: emptyProcessCounts(),
    trace: [],
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

export function parseHitlRequest(
  request: HitlRequest,
  fallbackTitle: string,
  questionFallbackTitle: string = fallbackTitle,
): {
  summary: string;
  detail?: string;
  actionType: 'question' | 'approval';
  questions?: HitlCardQuestion[];
  allowedDecisions: HitlDecisionType[];
} {
  const actionRequests = Array.isArray(request.action_requests) ? request.action_requests : [];
  const reviewConfigs = Array.isArray(request.review_configs) ? request.review_configs : [];

  const findAllowed = (actionName?: string): HitlDecisionType[] => {
    const config = reviewConfigs.find(c => !actionName || c.action_name === actionName);
    if (config?.allowed_decisions && Array.isArray(config.allowed_decisions)) {
      const filtered = config.allowed_decisions.filter(
        (d): d is HitlDecisionType => d === 'approve' || d === 'reject' || d === 'respond',
      );
      if (filtered.length > 0) {
        return filtered;
      }
    }
    return [];
  };

  const askUserReq = actionRequests.find(a => a.name === 'ask_user_question');
  if (askUserReq) {
    const args = askUserReq.args as { questions?: unknown } | null | undefined;
    const rawQuestions = Array.isArray(args?.questions) ? args.questions : [];
    const questions: HitlCardQuestion[] = rawQuestions.map(q => {
      const qObj = typeof q === 'object' && q !== null ? (q as Record<string, unknown>) : {};
      const questionText = typeof qObj.question === 'string' ? qObj.question : '';
      const rawOptions = Array.isArray(qObj.options) ? qObj.options : [];
      const options: HitlCardOption[] = rawOptions.map(opt => {
        if (typeof opt === 'string') {
          return { label: opt };
        }
        if (typeof opt === 'object' && opt !== null) {
          const optObj = opt as Record<string, unknown>;
          return {
            label: typeof optObj.label === 'string' ? optObj.label : String(optObj.text ?? ''),
            description: typeof optObj.description === 'string' ? optObj.description : undefined,
            value: typeof optObj.value === 'string' ? optObj.value : undefined,
          };
        }
        return { label: String(opt) };
      });
      return { question: questionText, options: options.length > 0 ? options : undefined };
    });

    const summary = questions[0]?.question || questionFallbackTitle;
    const allowed = findAllowed('ask_user_question');
    const allowedDecisions = allowed.length > 0 ? allowed : (['respond'] as HitlDecisionType[]);

    return {
      summary,
      actionType: 'question',
      questions: questions.length > 0 ? questions : undefined,
      allowedDecisions,
    };
  }

  if (actionRequests.length > 0) {
    const firstReq = actionRequests[0];
    const allowed = findAllowed(firstReq.name);
    const allowedDecisions =
      allowed.length > 0 ? allowed : (['approve', 'reject'] as HitlDecisionType[]);
    const summary =
      typeof request.message === 'string' && request.message.trim()
        ? request.message
        : `${fallbackTitle}: ${firstReq.name}`;
    const detailParts: string[] = [];
    if (firstReq.args !== undefined) {
      try {
        const rendered =
          typeof firstReq.args === 'string'
            ? firstReq.args
            : JSON.stringify(firstReq.args, null, 2);
        if (rendered && rendered !== '{}' && rendered !== 'null') {
          detailParts.push(rendered);
        }
      } catch {
        // ignore
      }
    }
    return {
      summary,
      detail: detailParts.length > 0 ? detailParts.join('\n') : undefined,
      actionType: 'approval',
      allowedDecisions,
    };
  }

  // Fallback for flat legacy request frames
  let summary = fallbackTitle;
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
  const allowed = findAllowed();
  const allowedDecisions =
    allowed.length > 0 ? allowed : (['approve', 'reject'] as HitlDecisionType[]);
  const detail = detailParts.length > 0 ? detailParts.join('\n') : undefined;
  return { summary, detail, actionType: 'approval', allowedDecisions };
}

export function hitlSummary(
  request: HitlRequest,
  fallback: string,
): { summary: string; detail?: string } {
  const parsed = parseHitlRequest(request, fallback);
  return { summary: parsed.summary, detail: parsed.detail };
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
        trace: action.trace ?? state.trace,
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
        // Each send starts a fresh trace; the card explains the turn in flight.
        trace: [],
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

    case 'hitlDecide': {
      const turnsWithoutHitl = state.turns.filter(t => t.kind !== 'hitl');
      let turns = turnsWithoutHitl;
      let idSeq = state.idSeq;
      if (action.userMessage) {
        const next = nextId({ idSeq } as ChatTurnState, 'u');
        turns = [...turnsWithoutHitl, { kind: 'user', id: next.id, text: action.userMessage }];
        idSeq = next.idSeq;
      }
      return {
        ...state,
        idSeq,
        hitl: null,
        turns,
        streaming: true,
        busy: true,
      };
    }

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
        case 'reasoning': {
          const delta = (action.frame as { content?: unknown }).content;
          if (typeof delta !== 'string' || !delta) {
            return { ...next, streaming: true, busy: true };
          }
          return {
            ...next,
            trace: appendReasoning(next.trace, delta),
            streaming: true,
            busy: true,
          };
        }
        case 'tool_call_chunk': {
          const frame = action.frame as { name?: unknown; index?: unknown; display_name?: unknown };
          if (typeof frame.name !== 'string') {
            return next;
          }
          return {
            ...next,
            trace: appendToolCall(next.trace, {
              index: typeof frame.index === 'number' ? frame.index : next.trace.length,
              name: frame.name,
              displayName: typeof frame.display_name === 'string' ? frame.display_name : undefined,
            }),
          };
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
          const request = (action.frame as { request?: HitlRequest }).request;
          const pendingId =
            request && typeof request.pending_id === 'string' ? request.pending_id : null;
          if (!pendingId || !request) {
            // Fail closed — no actionable pending id.
            return clearBusy(next);
          }
          const parsed = parseHitlRequest(
            request,
            action.defaults.hitlTitle,
            action.defaults.hitlQuestionTitle ?? action.defaults.hitlTitle,
          );
          const { id, idSeq } = nextId(next, 'h');
          const hitl: HitlPending = {
            pendingId,
            summary: parsed.summary,
            detail: parsed.detail,
            actionType: parsed.actionType,
            questions: parsed.questions,
            allowedDecisions: parsed.allowedDecisions,
          };
          return {
            ...next,
            idSeq,
            streaming: false,
            busy: true,
            stopRequested: false,
            hitl,
            turns: [
              ...next.turns.filter(t => t.kind !== 'hitl'),
              {
                kind: 'hitl',
                id,
                pendingId,
                summary: parsed.summary,
                detail: parsed.detail,
                actionType: parsed.actionType,
                questions: parsed.questions,
                allowedDecisions: parsed.allowedDecisions,
              },
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
