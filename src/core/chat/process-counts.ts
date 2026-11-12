/**
 * Process-card tallies for a live chat turn stream.
 *
 * Server frames stream deltas: many `reasoning` / `tool_call_chunk` messages
 * belong to one thinking step or one tool call. Counting every frame would
 * report hundreds of "深度思考" for a single contiguous thought.
 */

export interface ProcessCounts {
  tools: number;
  thinking: number;
}

export interface ProcessCountState extends ProcessCounts {
  /** True while the latest frames are still inside a reasoning burst. */
  inReasoning: boolean;
  /** Tool-call indexes already counted from `tool_call_chunk`. */
  seenToolIndexes: ReadonlySet<number>;
}

export function emptyProcessCounts(): ProcessCountState {
  return {
    tools: 0,
    thinking: 0,
    inReasoning: false,
    seenToolIndexes: new Set(),
  };
}

export type CountableFrame =
  | { type: 'reasoning' }
  | { type: 'token' }
  | { type: 'tool_call_chunk'; index: number }
  | { type: 'tool_result' }
  | { type: 'turn.started' }
  | { type: 'turn.ended' }
  | { type: 'done' };

/**
 * Fold one server frame into the process-card counters.
 * - thinking: +1 when a new contiguous reasoning burst starts
 * - tools: +1 the first time a given `tool_call_chunk.index` appears
 */
export function applyProcessFrame(
  state: ProcessCountState,
  frame: CountableFrame,
): ProcessCountState {
  switch (frame.type) {
    case 'reasoning': {
      if (state.inReasoning) {
        return state;
      }
      return {
        ...state,
        thinking: state.thinking + 1,
        inReasoning: true,
      };
    }
    case 'tool_call_chunk': {
      const { index } = frame;
      const already = state.seenToolIndexes.has(index);
      if (already && !state.inReasoning) {
        return state;
      }
      const seenToolIndexes = already
        ? state.seenToolIndexes
        : new Set(state.seenToolIndexes).add(index);
      return {
        ...state,
        tools: already ? state.tools : state.tools + 1,
        inReasoning: false,
        seenToolIndexes,
      };
    }
    case 'turn.started':
      // Tool-call indexes restart each turn; keep cumulative tallies.
      return {
        ...state,
        inReasoning: false,
        seenToolIndexes: new Set(),
      };
    case 'token':
    case 'tool_result':
    case 'turn.ended':
    case 'done':
      if (!state.inReasoning) {
        return state;
      }
      return { ...state, inReasoning: false };
    default:
      return state;
  }
}
