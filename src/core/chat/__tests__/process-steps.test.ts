import type { HistoryMessage } from '../../api/types';
import { appendReasoning, appendToolCall, stepsFromHistory } from '../process-steps';

describe('appendReasoning', () => {
  it('opens a thinking step and grows it with each delta', () => {
    let steps = appendReasoning([], '先看');
    steps = appendReasoning(steps, '一下容器');
    expect(steps).toEqual([{ kind: 'thinking', text: '先看一下容器' }]);
  });

  it('starts a new step after a tool call', () => {
    let steps = appendToolCall([], { index: 0, name: 'shell' });
    steps = appendReasoning(steps, '结果发现了问题');
    expect(steps.map(s => s.kind)).toEqual(['tool', 'thinking']);
  });

  it('ignores empty deltas', () => {
    const steps = appendReasoning([], 'x');
    expect(appendReasoning(steps, '')).toBe(steps);
  });
});

describe('appendToolCall', () => {
  it('folds chunks of one call into a single step', () => {
    let steps = appendToolCall([], { index: 0, name: 'shell' });
    steps = appendToolCall(steps, { index: 0, name: 'shell' });
    expect(steps).toHaveLength(1);
  });

  it('prefers the display name, including when it arrives later', () => {
    let steps = appendToolCall([], { index: 2, name: 'browser_open' });
    steps = appendToolCall(steps, { index: 2, name: 'browser_open', displayName: '打开浏览器' });
    expect(steps).toEqual([{ kind: 'tool', name: '打开浏览器', index: 2 }]);
  });

  it('keeps separate steps for separate indexes', () => {
    let steps = appendToolCall([], { index: 0, name: 'a' });
    steps = appendToolCall(steps, { index: 1, name: 'b' });
    expect(steps).toHaveLength(2);
  });
});

describe('stepsFromHistory', () => {
  const assistant = (content: HistoryMessage['content']): HistoryMessage => ({
    role: 'assistant',
    content,
  });

  it('reads thinking and tool blocks from the latest assistant message', () => {
    const steps = stepsFromHistory([
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      assistant([
        { type: 'thinking', thinking: '先查状态' },
        { type: 'tool_use', name: 'shell', id: 't1', input: {} },
        { type: 'text', text: '好了' },
      ]),
    ]);
    expect(steps).toEqual([
      { kind: 'thinking', text: '先查状态' },
      { kind: 'tool', name: 'shell', index: 0 },
    ]);
  });

  it('returns nothing when the last answer carries no trace', () => {
    expect(stepsFromHistory([assistant([{ type: 'text', text: 'plain' }])])).toEqual([]);
  });

  it('returns nothing without an assistant message', () => {
    expect(stepsFromHistory([{ role: 'user', content: [] }])).toEqual([]);
  });
});
