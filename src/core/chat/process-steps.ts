import type { HistoryMessage } from '../api/types';

/**
 * One entry of the "process" trace shown when a transcript's summary row is
 * expanded: a contiguous reasoning burst, or one tool call.
 *
 * Frames stream in pieces, so a burst arrives as many `reasoning` deltas and a
 * single call as many `tool_call_chunk`s — the builders below fold them so the
 * card shows steps, not frames.
 */
export type ProcessStep =
  { kind: 'thinking'; text: string } | { kind: 'tool'; name: string; index: number };

/** Append a reasoning delta to the trailing thinking step, or open a new one. */
export function appendReasoning(steps: ProcessStep[], delta: string): ProcessStep[] {
  if (!delta) {
    return steps;
  }
  const last = steps[steps.length - 1];
  if (last && last.kind === 'thinking') {
    const next = [...steps];
    next[next.length - 1] = { kind: 'thinking', text: last.text + delta };
    return next;
  }
  return [...steps, { kind: 'thinking', text: delta }];
}

/**
 * Record a tool call. Chunks of the same call (same index) update the name in
 * place — the display name often arrives after the first chunk.
 */
export function appendToolCall(
  steps: ProcessStep[],
  call: { index: number; name: string; displayName?: string },
): ProcessStep[] {
  const name = call.displayName?.trim() || call.name;
  const last = steps[steps.length - 1];
  if (last && last.kind === 'tool' && last.index === call.index) {
    if (last.name === name) {
      return steps;
    }
    const next = [...steps];
    next[next.length - 1] = { kind: 'tool', name, index: call.index };
    return next;
  }
  return [...steps, { kind: 'tool', name, index: call.index }];
}

/**
 * Rebuild the trace of the latest exchange from history blocks, so a thread
 * opened later still explains how its last answer was produced. Thinking text
 * comes from `thinking` blocks; tool calls from `tool_use`.
 */
export function stepsFromHistory(messages: HistoryMessage[]): ProcessStep[] {
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  if (!lastAssistant) {
    return [];
  }
  let steps: ProcessStep[] = [];
  let toolIndex = 0;
  for (const block of lastAssistant.content) {
    if (block.type === 'thinking' && block.thinking.trim()) {
      steps = appendReasoning(steps, block.thinking);
    } else if (block.type === 'tool_use') {
      steps = appendToolCall(steps, {
        index: toolIndex,
        name: block.name,
      });
      toolIndex += 1;
    }
  }
  return steps;
}

/**
 * Reasoning text as it should be shown: deltas stream in with the newlines that
 * separated one burst from the next still attached, and iOS lays a trailing
 * newline out as an empty line (Android drops it), which reads as a stray blank
 * row under the text. Runs of blank lines inside the text are folded for the
 * same reason.
 */
export function reasoningText(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** True when a step has something to draw in the expanded card. */
export function stepIsVisible(step: ProcessStep): boolean {
  return step.kind === 'tool' ? step.name.trim() !== '' : reasoningText(step.text) !== '';
}
