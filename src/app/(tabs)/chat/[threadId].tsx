import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { ChatInput } from '@/components/ChatInput';
import { ProcessCard, UserBubble } from '@/components/ChatPieces';
import { TypingDots } from '@/components/TypingDots';
import { readableText, ThreadsApi } from '@/core/api/threads';
import { balanceStreamingMarkdown } from '@/utils/streaming-markdown';
import Markdown from 'react-native-markdown-display';
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
import { continuousCorners, layout, radius, typeScale, useTheme } from '@/theme';

// The one sanctioned fontFamily: code needs a monospace face, and the
// markdown library's iOS default (Courier) is a typewriter font.
const CODE_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

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
  const socketRef = useRef<ChatSocket | null>(null);
  const threadRef = useRef<string | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const ensureThreadRef = useRef<(() => Promise<string | null>) | null>(null);
  // Process-card counters fold streaming deltas into session/tool units;
  // the ref holds the fold state so chunk bursts do not inflate the UI.
  const processCountsRef = useRef(emptyProcessCounts());

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
        // The library defaults draw a 1px #CCC border and black table
        // rules; every border here comes from tokens instead.
        borderWidth: 0,
        borderRadius: radius.chip,
        paddingHorizontal: 6,
        paddingVertical: 1,
        fontFamily: undefined,
      },
      // Fenced code is a text node in this library, so its type size lives
      // on `fence` itself (13pt mono wraps far less than the 17pt body).
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
      table: {
        borderColor: tokens.borderStrong,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.pill,
        marginVertical: 6,
      },
      tr: { borderColor: tokens.borderStrong, borderBottomWidth: StyleSheet.hairlineWidth },
      th: { padding: 8 },
      td: { padding: 8 },
    }),
    [tokens],
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
          // The forward-compat union member also matches 'token'; narrow it.
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
        case 'error': {
          const message = (frame as { message?: unknown }).message;
          flushTokens();
          setStreaming(false);
          setTurns(prev => [
            ...prev,
            { role: 'assistant', text: typeof message === 'string' ? message : 'error' },
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
          const replay = page.messages
            .map(m => ({ role: m.role, text: readableText(m.content) }))
            .filter(
              (m): m is Turn => (m.role === 'user' || m.role === 'assistant') && m.text.length > 0,
            );
          if (replay.length > 0) {
            setTurns(replay);
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
        setTurns([{ role: 'user', text: initialText }]);
        const threadId = await ensureThread();
        if (threadId && !disposed) {
          socket.sendUserTurn({ text: initialText, thread_id: threadId });
        }
      })();
    } else if (params.thread) {
      // Existing conversation: attach + replay without sending.
      void ensureThread();
    }

    return () => {
      disposed = true;
      socket.close();
      socketRef.current = null;
      ensureThreadRef.current = null;
    };
  }, [baseUrl, user, initialText, handleFrame]);

  const send = (text: string) => {
    if (connection !== 'open') {
      return;
    }
    setTurns(prev => [...prev, { role: 'user', text }]);
    void (async () => {
      const threadId = await ensureThreadRef.current?.();
      if (threadId) {
        socketRef.current?.sendUserTurn({ text, thread_id: threadId });
      }
    })();
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
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            // Drag the transcript to put the keyboard away, as in Messages.
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <UserTurnItem key={`u-${index}`} turn={turn} />
              ) : (
                <AssistantTurnItem
                  key={`a-${index}`}
                  turn={turn}
                  streaming={streaming && index === turns.length - 1}
                  mdStyles={mdStyles}
                />
              ),
            )}
            {toolCount + thinkingCount > 0 ? (
              <ProcessCard tools={toolCount} thinking={thinkingCount} />
            ) : null}
            {turns.length === 0 ? (
              <Text style={[styles.hintText, { color: tokens.textTertiary }]}>
                {connection === 'open' ? strings.chat.waiting : strings.chat.connecting}
              </Text>
            ) : null}
            {streaming && (turns.length === 0 || turns[turns.length - 1].role === 'user') ? (
              <TypingDots label={strings.chat.replying} />
            ) : null}
          </ScrollView>
          <View style={styles.inputWrap}>
            <ChatInput onSend={send} />
          </View>
        </KeyboardInsetView>
      </SafeAreaView>
    </View>
  );
}

// Completed turns keep their object identity across flushes, so these
// memoized items skip re-rendering while the streaming tail updates.
const UserTurnItem = memo(function UserTurnItem({ turn }: { turn: Turn }) {
  return <UserBubble text={turn.text} />;
});

const AssistantTurnItem = memo(function AssistantTurnItem({
  turn,
  streaming,
  mdStyles,
}: {
  turn: Turn;
  streaming: boolean;
  mdStyles: Record<string, object>;
}) {
  return (
    <View style={styles.assistantBlock}>
      <Markdown style={mdStyles}>
        {streaming ? `${balanceStreamingMarkdown(turn.text)} ▍` : turn.text}
      </Markdown>
    </View>
  );
});

function appendAssistant(prev: Turn[], delta: string): Turn[] {
  if (prev.length === 0 || prev[prev.length - 1].role !== 'assistant') {
    return [...prev, { role: 'assistant', text: delta }];
  }
  const next = prev.slice();
  next[next.length - 1] = { role: 'assistant', text: next[next.length - 1].text + delta };
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
});
