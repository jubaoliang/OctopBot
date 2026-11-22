import {
  endsStopWait,
  initialChatTurnState,
  mergeHistoryTurns,
  reduceChatTurn,
  type ChatTurn,
} from '../turn-reducer';

describe('reduceChatTurn', () => {
  it('ignores frames for a different thread_id', () => {
    let state = reduceChatTurn(initialChatTurnState(), {
      type: 'threadReady',
      threadId: 't-1',
    });
    state = reduceChatTurn(state, {
      type: 'frame',
      frame: { type: 'token', content: 'hi', thread_id: 't-other' },
      defaults: { hitlTitle: 'HITL', sendFailed: 'failed' },
    });
    expect(state.streaming).toBe(false);
    expect(state.turns).toHaveLength(0);
  });

  it('accepts frames without thread_id or matching thread_id', () => {
    let state = reduceChatTurn(initialChatTurnState(), {
      type: 'threadReady',
      threadId: 't-1',
    });
    state = reduceChatTurn(state, {
      type: 'frame',
      frame: { type: 'turn.started', turn_id: 'u1', seq: 1, phase: 'run', thread_id: 't-1' },
      defaults: { hitlTitle: 'HITL', sendFailed: 'failed' },
    });
    expect(state.streaming).toBe(true);
    expect(state.busy).toBe(true);
  });

  it('marks busy on userSend and clears on terminal done', () => {
    let state = reduceChatTurn(initialChatTurnState(), {
      type: 'userSend',
      text: 'hello',
    });
    expect(state.busy).toBe(true);
    expect(state.turns[0]).toMatchObject({ kind: 'user', text: 'hello' });
    state = reduceChatTurn(state, {
      type: 'flushTokens',
      delta: 'world',
    });
    expect(state.turns[1]).toMatchObject({ kind: 'assistant', text: 'world' });
    state = reduceChatTurn(state, {
      type: 'frame',
      frame: { type: 'done' },
      defaults: { hitlTitle: 'HITL', sendFailed: 'failed' },
    });
    expect(state.busy).toBe(false);
    expect(state.streaming).toBe(false);
  });

  it('keeps busy after stopRequested until terminal frame', () => {
    let state = reduceChatTurn(initialChatTurnState(), {
      type: 'userSend',
      text: 'x',
    });
    state = reduceChatTurn(state, { type: 'stopRequested' });
    expect(state.busy).toBe(true);
    expect(state.stopRequested).toBe(true);
    state = reduceChatTurn(state, {
      type: 'frame',
      frame: { type: 'turn.ended', turn_id: 'u1', failed: null },
      defaults: { hitlTitle: 'HITL', sendFailed: 'failed' },
    });
    expect(state.busy).toBe(false);
    expect(state.stopRequested).toBe(false);
  });

  it('merges history without wiping live assistant text on same thread', () => {
    let state = reduceChatTurn(initialChatTurnState(), {
      type: 'threadReady',
      threadId: 't-1',
    });
    state = reduceChatTurn(state, {
      type: 'userSend',
      text: 'live',
    });
    state = reduceChatTurn(state, { type: 'flushTokens', delta: 'partial' });
    const history: ChatTurn[] = [
      { kind: 'user', id: 'h-u', text: 'older' },
      { kind: 'assistant', id: 'h-a', text: 'reply' },
    ];
    state = reduceChatTurn(state, {
      type: 'historyLoaded',
      threadId: 't-1',
      turns: history,
    });
    expect(state.turns.map(t => (t.kind === 'hitl' ? t.summary : t.text))).toEqual([
      'older',
      'reply',
      'live',
      'partial',
    ]);
  });

  it('ignores stale history for another thread', () => {
    let state = reduceChatTurn(initialChatTurnState(), {
      type: 'threadReady',
      threadId: 't-1',
    });
    state = reduceChatTurn(state, {
      type: 'userSend',
      text: 'keep',
    });
    state = reduceChatTurn(state, {
      type: 'historyLoaded',
      threadId: 't-2',
      turns: [{ kind: 'user', id: 'x', text: 'other' }],
    });
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({ kind: 'user', text: 'keep' });
  });

  it('records HITL with pending_id and drops when missing', () => {
    let state = reduceChatTurn(initialChatTurnState(), {
      type: 'frame',
      frame: {
        type: 'hitl_required',
        request: { pending_id: 'p-1', message: 'Allow shell?', tool: 'bash' },
      },
      defaults: { hitlTitle: 'Confirm', sendFailed: 'failed' },
    });
    expect(state.hitl).toMatchObject({ pendingId: 'p-1', summary: 'Allow shell?' });
    expect(state.hitl?.detail).toContain('bash');
    expect(state.busy).toBe(true);

    state = reduceChatTurn(initialChatTurnState(), {
      type: 'frame',
      frame: {
        type: 'hitl_required',
        request: { pending_id: undefined as unknown as string },
      },
      defaults: { hitlTitle: 'Confirm', sendFailed: 'failed' },
    });
    expect(state.hitl).toBeNull();
  });

  it('honors turn_status.active', () => {
    let state = reduceChatTurn(initialChatTurnState(), {
      type: 'threadReady',
      threadId: 't-1',
    });
    state = reduceChatTurn(state, {
      type: 'frame',
      frame: { type: 'turn_status', thread_id: 't-1', active: true },
      defaults: { hitlTitle: 'HITL', sendFailed: 'failed' },
    });
    expect(state.busy).toBe(true);
    state = reduceChatTurn(state, {
      type: 'frame',
      frame: { type: 'turn_status', thread_id: 't-1', active: false },
      defaults: { hitlTitle: 'HITL', sendFailed: 'failed' },
    });
    expect(state.busy).toBe(false);
  });
});

describe('mergeHistoryTurns', () => {
  it('appends only unseen live turns', () => {
    const history: ChatTurn[] = [{ kind: 'user', id: '1', text: 'a' }];
    const live: ChatTurn[] = [
      { kind: 'user', id: '1b', text: 'a' },
      { kind: 'assistant', id: '2', text: 'b' },
    ];
    expect(
      mergeHistoryTurns(live, history).map(t => (t.kind === 'hitl' ? t.summary : t.text)),
    ).toEqual(['a', 'b']);
  });
});

describe('endsStopWait', () => {
  it('matches every frame type that clears stopRequested in the reducer', () => {
    const terminal: Record<string, unknown>[] = [
      { type: 'turn.started', thread_id: 't-1' },
      { type: 'turn.resumed', thread_id: 't-1' },
      { type: 'turn.ended', thread_id: 't-1' },
      { type: 'done', thread_id: 't-1' },
      { type: 'error', thread_id: 't-1' },
      { type: 'hitl_required', thread_id: 't-1' },
      { type: 'turn_status', thread_id: 't-1', active: false },
      { type: 'turn_status', thread_id: 't-1' },
    ];
    for (const frame of terminal) {
      expect(endsStopWait(frame as never)).toBe(true);
    }
  });

  it('does not match streaming or non-terminal frames', () => {
    const nonTerminal: Record<string, unknown>[] = [
      { type: 'turn_status', thread_id: 't-1', active: true },
      { type: 'token', thread_id: 't-1', content: 'x' },
      { type: 'reasoning', thread_id: 't-1', content: 'x' },
    ];
    for (const frame of nonTerminal) {
      expect(endsStopWait(frame as never)).toBe(false);
    }
  });
});

describe('device tool approval turns', () => {
  it('renders an inline hitl card carrying the device call', () => {
    const state = reduceChatTurn(initialChatTurnState(), {
      type: 'deviceToolCall',
      callId: 'c-1',
      name: 'calendar.create_event',
      input: { title: 'X' },
      summary: 'Create event X',
    });
    expect(state.busy).toBe(true);
    expect(state.hitl?.deviceCall).toEqual({
      callId: 'c-1',
      name: 'calendar.create_event',
      input: { title: 'X' },
    });
    expect(state.turns.at(-1)).toMatchObject({ kind: 'hitl', pendingId: 'c-1' });
  });

  it('hitlDecide clears the inline card after the decision', () => {
    let state = reduceChatTurn(initialChatTurnState(), {
      type: 'deviceToolCall',
      callId: 'c-1',
      name: 'phone.dial',
      input: { number: '123' },
      summary: 'Dial 123',
    });
    state = reduceChatTurn(state, { type: 'hitlDecide' });
    expect(state.hitl).toBeNull();
    expect(state.turns.filter(t => t.kind === 'hitl')).toHaveLength(0);
  });
});
