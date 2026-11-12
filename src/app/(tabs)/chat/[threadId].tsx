import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Markdown from 'react-native-markdown-display';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { ChatInput } from '@/components/ChatInput';
import { ProcessCard, UserBubble } from '@/components/ChatPieces';
import { CodeFence, InlineCode } from '@/components/MarkdownCode';
import { MarkdownTable } from '@/components/MarkdownTable';
import { PressableScale } from '@/components/PressableScale';
import { TypingDots } from '@/components/TypingDots';
import { ChatApi } from '@/core/api/chat';
import { processCountsFromHistory, readableText, ThreadsApi } from '@/core/api/threads';
import type { ServerFrame } from '@/core/api/types';
import { ChatSocket, type ChatConnectionStatus } from '@/core/chat/chat-socket';
import {
  applyProcessFrame,
  emptyProcessCounts,
  type CountableFrame,
} from '@/core/chat/process-counts';
import { useAppShell } from '@/features/app-shell';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { KeyboardInsetView } from '@/platform/keyboard';
import { CODE_FONT } from '@/theme/code-font';
import { continuousCorners, layout, radius, typeScale, useTheme } from '@/theme';
import { balanceStreamingMarkdown } from '@/utils/streaming-markdown';

/** Minimal node shape used by custom fence / inline-code rules. */
interface MdNode {
  key: string;
  content?: string;
  sourceInfo?: string;
}

type MdRule = (
  node: MdNode,
  children: ReactNode[],
  parent: MdNode[],
  styles: Record<string, object>,
  inheritedStyles?: object,
) => ReactNode;

type MdRules = Record<string, MdRule>;

type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'error'; text: string; retryText?: string }
  | { kind: 'hitl'; pendingId: string; summary: string };

/**
 * 主聊天 — a real chat turn over the WebSocket contract: create thread,
 * subscribe, stream tokens/reasoning/tool frames into bubbles, send
 * follow-ups from the composer.
 */
export default function ThreadScreen() {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const { baseUrl, token, httpClient, user } = useAuth();
  // Route params: threadId doubles as the initial prompt text from a
  // suggestion pill ('new' = no prompt, e.g. entering from the experts
  // roster); agent selects the expert; title overrides the header.
  const params = useLocalSearchParams<{
    threadId: string;
    agent?: string;
    thread?: string;
    title?: string;
  }>();
  const initialText =
    params.threadId === 'new' || params.threadId === 'open' ? null : params.threadId;
  const tabBarFootprint = useTabBarFootprint();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [toolCount, setToolCount] = useState(0);
  const [thinkingCount, setThinkingCount] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [connection, setConnection] = useState<ChatConnectionStatus>('idle');
  const [hitl, setHitl] = useState<{ pendingId: string; summary: string } | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);
  const threadRef = useRef<string | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const ensureThreadRef = useRef<(() => Promise<string | null>) | null>(null);
  const nearBottomRef = useRef(true);
  // Process-card counters fold streaming deltas into session/tool units;
  // the ref holds the fold state so chunk bursts do not inflate the UI.
  const processCountsRef = useRef(emptyProcessCounts());
  // Locale copy via ref so handleFrame identity stays stable across language
  // switches (otherwise the socket effect tears down mid-conversation).
  const stringsRef = useRef(strings);
  useEffect(() => {
    stringsRef.current = strings;
  }, [strings]);

  // Markdown typography from the token system — no hardcoded colors.
  const mdStyles = useMemo(
    () => ({
      body: { color: tokens.textBody, ...typeScale.reading },
      paragraph: { marginTop: 0, marginBottom: 10 },
      strong: { color: tokens.textPrimary, fontWeight: '600' as const },
      em: { color: tokens.textBody },
      link: { color: tokens.accent },
      bullet_text_icon: { color: tokens.textSecondary },
      code_inline: {
        color: tokens.textBody,
        backgroundColor: tokens.overlaySubtle,
        borderWidth: 0,
        borderRadius: radius.chip,
        paddingHorizontal: 6,
        paddingVertical: 1,
        fontFamily: CODE_FONT,
      },
      fence: {
        color: tokens.textBody,
        backgroundColor: tokens.overlaySubtle,
        borderColor: tokens.borderSubtle,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.pill,
        ...continuousCorners,
        padding: 12,
        marginVertical: 6,
        ...typeScale.footnote,
        fontFamily: CODE_FONT,
      },
      code_block: {
        color: tokens.textBody,
        backgroundColor: tokens.overlaySubtle,
        borderColor: tokens.borderSubtle,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.pill,
        ...continuousCorners,
        padding: 12,
        marginVertical: 6,
        ...typeScale.footnote,
        fontFamily: CODE_FONT,
      },
      blockquote: {
        backgroundColor: tokens.overlaySubtle,
        borderLeftColor: tokens.borderStrong,
        borderLeftWidth: 3,
        borderRadius: radius.chip,
        paddingHorizontal: 12,
        paddingVertical: 6,
      },
      blockquote_text: { color: tokens.textSecondary },
      heading1: { color: tokens.textPrimary, ...typeScale.title2, marginTop: 8, marginBottom: 6 },
      heading2: { color: tokens.textPrimary, ...typeScale.title3, marginTop: 8, marginBottom: 6 },
      heading3: { color: tokens.textPrimary, ...typeScale.headline, marginTop: 6, marginBottom: 4 },
      hr: { backgroundColor: tokens.borderSubtle, height: 1 },
      // Cells must not flex:1 — that crushes wide tables into the viewport.
      // Horizontal scroll lives on MarkdownTable; the grid sizes to content.
      table: {
        borderColor: tokens.borderStrong,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.pill,
        ...continuousCorners,
        alignSelf: 'flex-start',
        overflow: 'hidden',
      },
      thead: {},
      tbody: {},
      tr: {
        borderColor: tokens.borderStrong,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'stretch',
      },
      th: {
        // flex:0 wins over the library default flex:1 so columns keep a
        // readable width and the table can overflow into sideways scroll.
        flex: 0,
        minWidth: 96,
        maxWidth: 280,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: tokens.overlaySubtle,
      },
      td: {
        flex: 0,
        minWidth: 96,
        maxWidth: 280,
        paddingHorizontal: 10,
        paddingVertical: 8,
      },
      // Wrap inside maxWidth — ellipsis is hard to reveal on a phone.
      th_text: {
        color: tokens.textPrimary,
        ...typeScale.footnote,
        fontWeight: '600' as const,
        flexShrink: 1,
      },
      td_text: { color: tokens.textBody, ...typeScale.footnote, flexShrink: 1 },
    }),
    [tokens],
  );

  const mdRules = useMemo<MdRules>(
    () => ({
      fence: (node: MdNode) => {
        const language =
          typeof node.sourceInfo === 'string' && node.sourceInfo.length > 0
            ? node.sourceInfo.trim()
            : undefined;
        return <CodeFence key={node.key} code={String(node.content ?? '')} language={language} />;
      },
      code_inline: (node, _children, _parent, _styles, inheritedStyles) => (
        <InlineCode
          key={node.key}
          text={String(node.content ?? '')}
          inheritedStyle={inheritedStyles}
        />
      ),
      code_block: (node: MdNode) => <CodeFence key={node.key} code={String(node.content ?? '')} />,
      table: (node, children, _parent, styles) => (
        <MarkdownTable key={node.key} style={styles._VIEW_SAFE_table}>
          {children}
        </MarkdownTable>
      ),
    }),
    [],
  );

  // Fresh token for the socket factory; sliding renewals land here.
  const tokenRef = useRef<string | null>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  // Defaults to the default expert on a fresh server install.
  const agentId = params.agent ?? 'main';

  // Streamed tokens buffer in a ref and flush ~8x/s — per-token renders
  // re-render the whole screen (incl. full markdown re-parse) at model
  // speed and visibly jank scrolling/animations.
  const pendingTokensRef = useRef('');
  const flushTokens = useCallback(() => {
    const delta = pendingTokensRef.current;
    if (delta) {
      pendingTokensRef.current = '';
      setTurns(prev => appendAssistant(prev, delta));
    }
  }, []);

  // Flush cadence while the screen is mounted; a final flush on unmount.
  useEffect(() => {
    const timer = setInterval(() => flushTokens(), 120);
    return () => {
      clearInterval(timer);
      flushTokens();
    };
  }, [flushTokens]);

  const handleFrame = useCallback(
    (frame: ServerFrame) => {
      const foldProcess = (countable: CountableFrame) => {
        const next = applyProcessFrame(processCountsRef.current, countable);
        if (
          next.tools !== processCountsRef.current.tools ||
          next.thinking !== processCountsRef.current.thinking
        ) {
          setToolCount(next.tools);
          setThinkingCount(next.thinking);
        }
        processCountsRef.current = next;
      };

      switch (frame.type) {
        case 'token': {
          const delta = (frame as { content?: unknown }).content;
          if (typeof delta === 'string') {
            setStreaming(true);
            pendingTokensRef.current += delta;
            foldProcess({ type: 'token' });
          }
          break;
        }
        case 'reasoning':
          foldProcess({ type: 'reasoning' });
          break;
        case 'tool_call_chunk': {
          const index = (frame as { index?: unknown }).index;
          if (typeof index === 'number') {
            foldProcess({ type: 'tool_call_chunk', index });
          }
          break;
        }
        case 'tool_result':
          foldProcess({ type: 'tool_result' });
          break;
        case 'turn.started':
          foldProcess({ type: 'turn.started' });
          setStreaming(true);
          setHitl(null);
          setTurns(prev => prev.filter(t => t.kind !== 'hitl'));
          break;
        case 'turn.ended':
          foldProcess({ type: 'turn.ended' });
          flushTokens();
          setStreaming(false);
          break;
        case 'done':
          foldProcess({ type: 'done' });
          flushTokens();
          setStreaming(false);
          break;
        case 'hitl_required': {
          flushTokens();
          setStreaming(false);
          const request = (frame as { request?: { pending_id?: unknown; [key: string]: unknown } })
            .request;
          const pendingId =
            request && typeof request.pending_id === 'string' ? request.pending_id : null;
          if (pendingId && request) {
            let summary = stringsRef.current.chat.hitlTitle;
            if (typeof request.message === 'string') {
              summary = request.message;
            } else if (typeof request.description === 'string') {
              summary = request.description;
            }
            setHitl({ pendingId, summary });
            setTurns(prev => [
              ...prev.filter(t => t.kind !== 'hitl'),
              { kind: 'hitl', pendingId, summary },
            ]);
          }
          break;
        }
        case 'error': {
          const message = (frame as { message?: unknown }).message;
          flushTokens();
          setStreaming(false);
          setTurns(prev => [
            ...prev,
            {
              kind: 'error',
              text: typeof message === 'string' ? message : stringsRef.current.chat.sendFailed,
            },
          ]);
          break;
        }
        default:
          break;
      }
    },
    [flushTokens],
  );

  // httpClient flows through a ref: identity changes (logout, URL switch)
  // must not rip the live socket; the effect keys on session identity.
  const httpClientRef = useRef(httpClient);
  useEffect(() => {
    httpClientRef.current = httpClient;
  }, [httpClient]);

  useEffect(() => {
    if (!baseUrl || !user) {
      return;
    }
    let disposed = false;
    const socket = new ChatSocket({
      baseUrl,
      path: `/api/agents/${agentId}/chat/ws`,
      tokenFactory: () => Promise.resolve(tokenRef.current),
      onFrame: frame => {
        if (!disposed) {
          handleFrame(frame);
        }
      },
      onStatus: status => {
        if (!disposed) {
          setConnection(status);
        }
      },
    });
    socketRef.current = socket;

    // Threads are created lazily on first send — visiting the screen never
    // leaves empty orphan threads behind on the server. Connection first,
    // then thread, then send: the socket must be open before subscribe or
    // the first turn is silently dropped.
    const ensureThread = async (): Promise<string | null> => {
      try {
        await socket.connect();
        if (disposed) {
          return null;
        }
        if (threadRef.current) {
          return threadRef.current;
        }
        if (params.thread) {
          // Opening an existing conversation: attach + replay history.
          threadRef.current = params.thread;
          socket.subscribe(params.thread);
          const page = await new ThreadsApi(httpClientRef.current).history(agentId, params.thread, {
            limit: 50,
          });
          if (disposed) {
            return null;
          }
          const replay: Turn[] = [];
          for (const m of page.messages) {
            if (m.role !== 'user' && m.role !== 'assistant') {
              continue;
            }
            const text = readableText(m.content);
            if (!text) {
              continue;
            }
            if (m.status === 'error') {
              replay.push({ kind: 'error', text });
            } else {
              replay.push({ kind: m.role, text });
            }
          }
          if (page.hitl_pending) {
            const pendingId = 'history-pending';
            const summary = stringsRef.current.chat.hitlTitle;
            replay.push({ kind: 'hitl', pendingId, summary });
            setHitl({ pendingId, summary });
          }
          if (replay.length > 0) {
            setTurns(replay);
          }
          const counts = processCountsFromHistory(page.messages);
          if (counts.tools + counts.thinking > 0) {
            processCountsRef.current = {
              ...emptyProcessCounts(),
              tools: counts.tools,
              thinking: counts.thinking,
            };
            setToolCount(counts.tools);
            setThinkingCount(counts.thinking);
          }
          return params.thread;
        }
        const created = await new ThreadsApi(httpClientRef.current).create(agentId);
        if (disposed) {
          return null;
        }
        threadRef.current = created.thread_id;
        socket.subscribe(created.thread_id);
        return created.thread_id;
      } catch {
        if (!disposed) {
          setConnection('closed');
        }
        return null;
      }
    };
    ensureThreadRef.current = ensureThread;

    if (initialText) {
      void (async () => {
        // Async continuation keeps setState out of the effect body.
        setTurns([{ kind: 'user', text: initialText }]);
        const threadId = await ensureThread();
        if (threadId && !disposed) {
          socket.sendUserTurn({ text: initialText, thread_id: threadId });
        } else if (!disposed) {
          setTurns(prev => [
            ...prev,
            { kind: 'error', text: strings.chat.sendFailed, retryText: initialText },
          ]);
        }
      })();
    } else if (params.thread) {
      // Existing conversation: attach + replay without sending.
      void ensureThread();
    } else {
      // Experts "new" / bare open: warm the socket so the first send works.
      void socket.connect().catch(() => undefined);
    }

    return () => {
      disposed = true;
      socket.close();
      socketRef.current = null;
      ensureThreadRef.current = null;
    };
    // agentId / params.thread are stable for the life of this route instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, user, initialText, handleFrame, agentId]);

  const send = (text: string) => {
    setTurns(prev => [...prev, { kind: 'user', text }]);
    void (async () => {
      const threadId = await ensureThreadRef.current?.();
      if (threadId && socketRef.current?.sendUserTurn({ text, thread_id: threadId })) {
        return;
      }
      setTurns(prev => [
        ...prev,
        { kind: 'error', text: strings.chat.sendFailed, retryText: text },
      ]);
    })();
  };

  const stop = () => {
    const threadId = threadRef.current;
    if (threadId) {
      socketRef.current?.cancel(threadId);
      void new ThreadsApi(httpClientRef.current).cancel(agentId, threadId).catch(() => undefined);
    }
    setStreaming(false);
  };

  const retrySend = (text: string) => {
    setTurns(prev => prev.filter(t => !(t.kind === 'error' && t.retryText === text)));
    send(text);
  };

  const decideHitl = (decision: 'approve' | 'reject') => {
    const pending = hitl;
    const threadId = threadRef.current;
    if (!pending || !threadId) {
      return;
    }
    setHitl(null);
    setTurns(prev => prev.filter(t => t.kind !== 'hitl'));
    setStreaming(true);
    let sawTerminal = false;
    void new ChatApi(httpClientRef.current)
      .resumeHitl(
        agentId,
        {
          thread_id: threadId,
          pending_id: pending.pendingId === 'history-pending' ? undefined : pending.pendingId,
          decisions: [{ type: decision }],
        },
        frame => {
          if (
            frame.type === 'turn.ended' ||
            frame.type === 'done' ||
            frame.type === 'hitl_required'
          ) {
            sawTerminal = true;
          }
          handleFrame(frame);
        },
      )
      .catch(() => {
        setStreaming(false);
        setTurns(prev => [...prev, { kind: 'error', text: strings.chat.hitlFailed }]);
      })
      .finally(() => {
        if (!sawTerminal) {
          setStreaming(false);
        }
      });
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 96;
  };

  const headerSubtitle = useMemo(() => {
    if (connection === 'reconnecting') {
      return strings.chat.reconnecting;
    }
    if (connection === 'unauthorized' || connection === 'closed') {
      return strings.chat.disconnected;
    }
    return user?.username ?? strings.chat.agentName;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, user?.username]);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* The composer rests above the tab bar and rides the keyboard. */}
        <KeyboardInsetView
          restingInset={tabBarFootprint}
          gap={layout.keyboardGap}
          style={styles.fill}
        >
          <AppHeader
            title={params.title ?? initialText ?? strings.chat.agentName}
            subtitle={headerSubtitle}
            onMenu={openDrawer}
          />
          <ScrollView
            ref={scrollRef}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              if (nearBottomRef.current) {
                scrollRef.current?.scrollToEnd({ animated: true });
              }
            }}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            // Drag the transcript to put the keyboard away, as in Messages.
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            {turns.map((turn, index) => {
              if (turn.kind === 'user') {
                return <UserTurnItem key={`u-${index}`} text={turn.text} />;
              }
              if (turn.kind === 'error') {
                return (
                  <ErrorTurnItem
                    key={`e-${index}`}
                    text={turn.text}
                    retryLabel={strings.chat.retrySend}
                    onRetry={turn.retryText ? () => retrySend(turn.retryText!) : undefined}
                  />
                );
              }
              if (turn.kind === 'hitl') {
                return (
                  <HitlCard
                    key={`h-${turn.pendingId}`}
                    summary={turn.summary}
                    approveLabel={strings.chat.hitlApprove}
                    rejectLabel={strings.chat.hitlReject}
                    onApprove={() => decideHitl('approve')}
                    onReject={() => decideHitl('reject')}
                  />
                );
              }
              return (
                <AssistantTurnItem
                  key={`a-${index}`}
                  text={turn.text}
                  streaming={streaming && index === turns.length - 1}
                  mdStyles={mdStyles}
                  mdRules={mdRules}
                />
              );
            })}
            {toolCount + thinkingCount > 0 ? (
              <ProcessCard tools={toolCount} thinking={thinkingCount} />
            ) : null}
            {turns.length === 0 ? (
              <Text style={[styles.hintText, { color: tokens.textTertiary }]}>
                {connection === 'open' ? strings.chat.waiting : strings.chat.connecting}
              </Text>
            ) : null}
            {streaming &&
            (turns.length === 0 ||
              turns[turns.length - 1].kind === 'user' ||
              turns[turns.length - 1].kind === 'hitl') ? (
              <TypingDots label={strings.chat.replying} />
            ) : null}
          </ScrollView>
          <View style={styles.inputWrap}>
            <ChatInput
              onSend={send}
              onStop={stop}
              streaming={streaming}
              canSend={
                !hitl &&
                (connection === 'open' || connection === 'connecting' || connection === 'idle')
              }
            />
          </View>
        </KeyboardInsetView>
      </SafeAreaView>
    </View>
  );
}

// Completed turns keep their object identity across flushes, so these
// memoized items skip re-rendering while the streaming tail updates.
const UserTurnItem = memo(function UserTurnItem({ text }: { text: string }) {
  return <UserBubble text={text} />;
});

const AssistantTurnItem = memo(function AssistantTurnItem({
  text,
  streaming,
  mdStyles,
  mdRules,
}: {
  text: string;
  streaming: boolean;
  mdStyles: Record<string, object>;
  mdRules: MdRules;
}) {
  return (
    <View style={styles.assistantBlock}>
      <Markdown style={mdStyles} rules={mdRules}>
        {streaming ? `${balanceStreamingMarkdown(text)} ▍` : text}
      </Markdown>
    </View>
  );
});

const ErrorTurnItem = memo(function ErrorTurnItem({
  text,
  retryLabel,
  onRetry,
}: {
  text: string;
  retryLabel: string;
  onRetry?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.errorCard,
        { backgroundColor: tokens.overlaySubtle, borderColor: tokens.borderSubtle },
      ]}
    >
      <Text style={[styles.errorText, { color: tokens.textSecondary }]}>{text}</Text>
      {onRetry ? (
        <PressableScale
          accessibilityRole="button"
          testID="chat-retry-send"
          onPress={onRetry}
          style={[styles.errorAction, { backgroundColor: tokens.surface }]}
        >
          <Text style={[styles.errorActionLabel, { color: tokens.textPrimary }]}>{retryLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
});

const HitlCard = memo(function HitlCard({
  summary,
  approveLabel,
  rejectLabel,
  onApprove,
  onReject,
}: {
  summary: string;
  approveLabel: string;
  rejectLabel: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.hitlCard,
        { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
      ]}
    >
      <Text style={[styles.hitlSummary, { color: tokens.textPrimary }]}>{summary}</Text>
      <View style={styles.hitlActions}>
        <PressableScale
          accessibilityRole="button"
          testID="hitl-reject"
          onPress={onReject}
          style={[styles.hitlButton, { backgroundColor: tokens.overlaySubtle }]}
        >
          <Text style={[styles.hitlButtonLabel, { color: tokens.textPrimary }]}>{rejectLabel}</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          testID="hitl-approve"
          onPress={onApprove}
          style={[styles.hitlButton, { backgroundColor: tokens.accent }]}
        >
          <Text style={[styles.hitlButtonLabel, { color: tokens.textInverse }]}>
            {approveLabel}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
});

function appendAssistant(prev: Turn[], delta: string): Turn[] {
  if (prev.length === 0 || prev[prev.length - 1].kind !== 'assistant') {
    return [...prev, { kind: 'assistant', text: delta }];
  }
  const next = prev.slice();
  const last = next[next.length - 1];
  if (last.kind !== 'assistant') {
    return [...prev, { kind: 'assistant', text: delta }];
  }
  next[next.length - 1] = { kind: 'assistant', text: last.text + delta };
  return next;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingTop: 0 },
  fill: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 24,
    gap: 20,
    paddingBottom: 24,
  },
  assistantBlock: {
    alignSelf: 'stretch',
  },
  hintText: {
    ...typeScale.subheadline,
    textAlign: 'center',
    marginTop: 24,
  },
  inputWrap: { paddingHorizontal: layout.screenMargin },
  errorCard: {
    alignSelf: 'stretch',
    gap: 10,
    padding: 14,
    borderRadius: radius.pill,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: { ...typeScale.subheadline },
  errorAction: {
    alignSelf: 'flex-start',
    minHeight: layout.hitTarget,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorActionLabel: { ...typeScale.headline },
  hitlCard: {
    alignSelf: 'stretch',
    gap: 12,
    padding: 14,
    borderRadius: radius.pill,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hitlSummary: { ...typeScale.reading },
  hitlActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  hitlButton: {
    minHeight: layout.hitTarget,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitlButtonLabel: { ...typeScale.headline },
});
