import { applyProcessFrame, emptyProcessCounts } from '../process-counts';

describe('applyProcessFrame', () => {
  it('counts one thinking step for a contiguous reasoning burst', () => {
    let state = emptyProcessCounts();
    for (let i = 0; i < 3; i += 1) {
      state = applyProcessFrame(state, { type: 'reasoning' });
    }
    expect(state.thinking).toBe(1);
    expect(state.tools).toBe(0);
  });

  it('counts a new thinking step after tokens interrupt reasoning', () => {
    let state = emptyProcessCounts();
    state = applyProcessFrame(state, { type: 'reasoning' });
    state = applyProcessFrame(state, { type: 'reasoning' });
    state = applyProcessFrame(state, { type: 'token' });
    state = applyProcessFrame(state, { type: 'reasoning' });
    state = applyProcessFrame(state, { type: 'reasoning' });
    expect(state.thinking).toBe(2);
  });

  it('counts each tool once across many tool_call_chunk deltas', () => {
    let state = emptyProcessCounts();
    for (let i = 0; i < 20; i += 1) {
      state = applyProcessFrame(state, { type: 'tool_call_chunk', index: 0 });
    }
    for (let i = 0; i < 5; i += 1) {
      state = applyProcessFrame(state, { type: 'tool_call_chunk', index: 1 });
    }
    expect(state.tools).toBe(2);
  });

  it('does not treat every reasoning delta as a separate deep-think', () => {
    // The pre-fix behaviour (+1 per frame) would report 659 here.
    let state = emptyProcessCounts();
    for (let i = 0; i < 659; i += 1) {
      state = applyProcessFrame(state, { type: 'reasoning' });
    }
    expect(state.thinking).toBe(1);
  });

  it('ends a reasoning burst on tool chunks so the next burst counts again', () => {
    let state = emptyProcessCounts();
    state = applyProcessFrame(state, { type: 'reasoning' });
    state = applyProcessFrame(state, { type: 'tool_call_chunk', index: 0 });
    state = applyProcessFrame(state, { type: 'reasoning' });
    expect(state).toMatchObject({ thinking: 2, tools: 1 });
  });

  it('recounts tool index 0 after turn.started resets the index set', () => {
    let state = emptyProcessCounts();
    state = applyProcessFrame(state, { type: 'tool_call_chunk', index: 0 });
    state = applyProcessFrame(state, { type: 'turn.started' });
    state = applyProcessFrame(state, { type: 'tool_call_chunk', index: 0 });
    expect(state.tools).toBe(2);
  });
});
