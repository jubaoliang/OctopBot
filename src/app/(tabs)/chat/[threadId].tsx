import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import type { ServerFrame, TurnAttachment } from '@/core/api/types';
import { ChatSocket, type ChatConnectionStatus } from '@/core/chat/chat-socket';
import { emptyProcessCounts } from '@/core/chat/process-counts';
import { initialChatTurnState, reduceChatTurn, type ChatTurn } from '@/core/chat/turn-reducer';
import { useAppShell } from '@/features/app-shell';
import { useAuth } from '@/features/auth';
import { takeChatHandoff } from '@/features/chat-handoff';
import { useImageAttachments } from '@/features/useImageAttachments';
import { useI18n } from '@/i18n/I18nProvider';
import { KeyboardInsetView } from '@/platform/keyboard';
import { confirmOpenHttpUrl } from '@/platform/linking';
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

/** Stop waits this long for a terminal frame before surfacing an error. */
const STOP_TIMEOUT_MS = 45_000;
/** A HITL resume request is abandoned after this long. */
const HITL_TIMEOUT_MS = 120_000;
const TOKEN_FLUSH_MS = 120;

/**
 * 主聊天 — a real chat turn over the WebSocket contract: create thread,
 * subscribe, stream tokens/reasoning/tool frames into bubbles, send
 * follow-ups from the composer.
 */
export default function ThreadScreen() {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const { baseUrl, token, httpClient, user, dropSession, sessionGeneration } = useAuth();
  // Route params: `threadId` is a path segment (`new` / `open` / forged deep
  // link). Internal suggestion pills pass `prompt` — never put user text in
  // the path, or an external `octopbot://chat/…` URL would auto-send.
  const params = useLocalSearchParams<{
    threadId: string;
    agent?: string;
    thread?: string;
    title?: string;
    prompt?: string;
    handoff?: string;
  }>();
  const internalPrompt =
    typeof params.prompt === 'string' && params.prompt.trim().length > 0 ? params.prompt : null;
  // Consume once so remount / StrictMode cannot re-send the home handoff.
  const [handoff] = useState(() => takeChatHandoff(params.handoff));
  const autoText = internalPrompt ?? handoff?.text ?? null;
  const autoAttachments = handoff?.attachments;
  const externalDraft =
    !internalPrompt && !params.thread && params.threadId !== 'new' && params.threadId !== 'open'
      ? params.threadId
      : null;
  const tabBarFootprint = useTabBarFootprint();
  // Defaults to the default expert on a fresh server install.
  const agentId = params.agent ?? 'main';
  const attachmentFlow = useImageAttachments(agentId);

  const [chat, dispatch] = useReducer(reduceChatTurn, undefined, initialChatTurnState);
  const [connection, setConnection] = useState<ChatConnectionStatus>('idle');
  const socketRef = useRef<ChatSocket | null>(null);
  const threadRef = useRef<string | null>(null);
  const scrollRef = useRef<FlatList<ChatTurn>>(null);
  const ensureThreadRef = useRef<(() => Promise<string | null>) | null>(null);
  const nearBottomRef = useRef(true);
  // Latest reducer state for timers / async callbacks that must not close
  // over a stale snapshot.
  const chatRef = useRef(chat);
  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitlAbortRef = useRef<AbortController | null>(null);
  const decidingRef = useRef(false);
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
      // Remote images contact third-party hosts — refuse by default.
      image: (node: MdNode) => (
        <Text key={node.key} style={{ color: tokens.textTertiary, ...typeScale.footnote }}>
          {strings.chat.imageBlocked}
        </Text>
      ),
    }),
    [strings.chat.imageBlocked, tokens.textTertiary],
  );

  const onMarkdownLink = useCallback(
    (url: string) =>
      confirmOpenHttpUrl(url, {
        title: strings.chat.openLinkTitle,
        message: strings.chat.openLinkMessage,
        cancel: strings.common.cancel,
        open: strings.chat.openLinkConfirm,
      }),
    [
      strings.chat.openLinkConfirm,
      strings.chat.openLinkMessage,
      strings.chat.openLinkTitle,
      strings.common.cancel,
    ],
  );

  // Fresh token for the socket factory; sliding renewals land here.
  const tokenRef = useRef<string | null>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  // Streamed tokens buffer in a ref and flush ~8x/s — per-token renders
  // re-render the whole screen (incl. full markdown re-parse) at model
  // speed and visibly jank scrolling/animations.
  const pendingTokensRef = useRef('');
  const flushTokens = useCallback(() => {
    const delta = pendingTokensRef.current;
    if (delta) {
      pendingTokensRef.current = '';
      dispatch({ type: 'flushTokens', delta });
    }
  }, []);

  // Flush cadence while the screen is mounted.
  useEffect(() => {
    const timer = setInterval(flushTokens, TOKEN_FLUSH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [flushTokens]);

  // Unmount: drop the stop watchdog and abandon any in-flight HITL resume.
  useEffect(
    () => () => {
      if (stopTimerRef.current !== null) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      hitlAbortRef.current?.abort();
    },
    [],
  );

  // A terminal frame (or timeout) ends the stop wait — disarm the watchdog.
  useEffect(() => {
    if (!chat.stopRequested && stopTimerRef.current !== null) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, [chat.stopRequested]);

  // An expired / rejected token ends the session instead of looping.
  useEffect(() => {
    if (connection === 'unauthorized') {
      dropSession();
    }
  }, [connection, dropSession]);

  // Mirror busy/streaming for the frame path so token bursts don't re-render.
  const streamingRef = useRef(chat.streaming);
  useEffect(() => {
    streamingRef.current = chat.streaming;
  }, [chat.streaming]);

  const handleFrame = useCallback(
    (frame: ServerFrame) => {
      const frameThread = (frame as { thread_id?: unknown }).thread_id;
      const foreign =
        typeof frameThread === 'string' &&
        threadRef.current !== null &&
        frameThread !== threadRef.current;
      if (frame.type === 'token') {
        if (!foreign && typeof frame.content === 'string') {
          pendingTokensRef.current += frame.content;
          // First token still marks busy; later tokens only buffer text.
          if (!streamingRef.current) {
            dispatch({
              type: 'frame',
              frame,
              defaults: {
                hitlTitle: stringsRef.current.chat.hitlTitle,
                sendFailed: stringsRef.current.chat.sendFailed,
              },
            });
            streamingRef.current = true;
          }
        }
        return;
      }
      // Buffered text lands before any terminal / structural frame.
      flushTokens();
      dispatch({
        type: 'frame',
        frame,
        defaults: {
          hitlTitle: stringsRef.current.chat.hitlTitle,
          sendFailed: stringsRef.current.chat.sendFailed,
        },
      });
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

    // One thread bootstrap per (agent, session) scope; concurrent callers
    // share the in-flight promise and a failure clears it for the next try.
    const scope = `${agentId}:${sessionGeneration}`;
    let inflight: { scope: string; promise: Promise<string | null> } | null = null;

    const loadThread = async (): Promise<string | null> => {
      await socket.connect();
      if (disposed) {
        return null;
      }
      if (threadRef.current) {
        // Socket was rebuilt for the same thread — re-attach.
        dispatch({ type: 'threadReady', threadId: threadRef.current });
        socket.subscribe(threadRef.current);
        return threadRef.current;
      }
      const threads = new ThreadsApi(httpClientRef.current);
      if (params.thread) {
        // Opening an existing conversation: replay history, then attach.
        const threadId = params.thread;
        dispatch({ type: 'threadReady', threadId });
        const page = await threads.history(agentId, threadId, { limit: 50 });
        if (disposed) {
          return null;
        }
        const replay: ChatTurn[] = [];
        for (const m of page.messages) {
          if (m.role !== 'user' && m.role !== 'assistant') {
            continue;
          }
          const text = readableText(m.content);
          if (!text) {
            continue;
          }
          const id = `hist-${replay.length}`;
          replay.push(
            m.status === 'error' ? { kind: 'error', id, text } : { kind: m.role, id, text },
          );
        }
        const counts = processCountsFromHistory(page.messages);
        dispatch({
          type: 'historyLoaded',
          threadId,
          turns: replay,
          // History only says "pending" without a pending_id — nothing
          // actionable to show, so fail closed (no card).
          hitl: null,
          process: { ...emptyProcessCounts(), tools: counts.tools, thinking: counts.thinking },
        });
        socket.subscribe(threadId);
        threadRef.current = threadId;
        return threadId;
      }
      const created = await threads.create(agentId);
      if (disposed) {
        return null;
      }
      dispatch({ type: 'threadReady', threadId: created.thread_id });
      socket.subscribe(created.thread_id);
      threadRef.current = created.thread_id;
      return created.thread_id;
    };

    // Threads are created lazily on first send — visiting the screen never
    // leaves empty orphan threads behind on the server. Connection first,
    // then thread, then send: the socket must be open before subscribe or
    // the first turn is silently dropped.
    const ensureThread = (): Promise<string | null> => {
      if (inflight?.scope === scope) {
        return inflight.promise;
      }
      const promise: Promise<string | null> = loadThread().catch(() => {
        if (inflight?.promise === promise) {
          inflight = null;
        }
        // An auth rejection keeps its own status so the session drops.
        if (!disposed && socket.status !== 'unauthorized') {
          setConnection('closed');
        }
        return null;
      });
      inflight = { scope, promise };
      return promise;
    };
    ensureThreadRef.current = ensureThread;

    const deliver = async (
      text: string,
      attachments: TurnAttachment[] | undefined,
    ): Promise<void> => {
      const threadId = await ensureThread();
      if (disposed) {
        return;
      }
      if (threadId && socket.sendUserTurn({ text, thread_id: threadId, attachments })) {
        return;
      }
      dispatch({
        type: 'sendFailed',
        message: stringsRef.current.chat.sendFailed,
        retryText: text,
        retryAttachments: attachments,
      });
    };

    if (autoText !== null) {
      const attachments =
        autoAttachments && autoAttachments.length > 0 ? autoAttachments : undefined;
      dispatch({ type: 'reset' });
      dispatch({ type: 'userSend', text: autoText, attachments });
      void deliver(autoText, attachments);
    } else if (externalDraft) {
      // Deep-linked path text is a draft — never auto-send without consent.
      void ensureThread();
      Alert.alert(strings.chat.externalPromptTitle, externalDraft, [
        { text: strings.chat.externalPromptDiscard, style: 'cancel' },
        {
          text: strings.chat.externalPromptSend,
          onPress: () => {
            dispatch({ type: 'userSend', text: externalDraft });
            void deliver(externalDraft, undefined);
          },
        },
      ]);
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
  }, [
    baseUrl,
    user,
    autoText,
    autoAttachments,
    externalDraft,
    handleFrame,
    agentId,
    sessionGeneration,
  ]);

  const send = (text: string, attachments?: TurnAttachment[]) => {
    dispatch({ type: 'userSend', text, attachments });
    void (async () => {
      const threadId = await ensureThreadRef.current?.();
      if (threadId && socketRef.current?.sendUserTurn({ text, thread_id: threadId, attachments })) {
        return;
      }
      dispatch({
        type: 'sendFailed',
        message: stringsRef.current.chat.sendFailed,
        retryText: text,
        retryAttachments: attachments,
      });
    })();
  };

  const stop = () => {
    if (chatRef.current.stopRequested) {
      return;
    }
    dispatch({ type: 'stopRequested' });
    const threadId = threadRef.current;
    if (threadId) {
      socketRef.current?.cancel(threadId);
      void new ThreadsApi(httpClientRef.current).cancel(agentId, threadId).catch(() => undefined);
    }
    // Stay busy until the server confirms with a terminal frame; if it never
    // does, release the composer with an error rather than hanging forever.
    if (stopTimerRef.current !== null) {
      clearTimeout(stopTimerRef.current);
    }
    stopTimerRef.current = setTimeout(() => {
      stopTimerRef.current = null;
      if (chatRef.current.stopRequested) {
        dispatch({ type: 'stopTimedOut', message: stringsRef.current.chat.stopTimedOut });
      }
    }, STOP_TIMEOUT_MS);
  };

  const sendWithAttachments = (text: string, attachments?: TurnAttachment[]) => {
    send(text, attachments);
    // Chips were uploaded for this turn; the composer starts fresh.
    attachmentFlow.clear();
  };

  const retrySend = (text: string, attachments?: TurnAttachment[]) => {
    dispatch({ type: 'clearRetry', retryText: text });
    send(text, attachments);
  };

  const decideHitl = (decision: 'approve' | 'reject') => {
    const pendingId = chatRef.current.hitl?.pendingId;
    const threadId = threadRef.current;
    // No real pending id → nothing actionable (fail closed).
    if (!pendingId || !threadId || decidingRef.current) {
      return;
    }
    decidingRef.current = true;
    dispatch({ type: 'hitlDecide' });
    const controller = new AbortController();
    hitlAbortRef.current = controller;
    const run = { timedOut: false, sawTerminal: false };
    const timeout = setTimeout(() => {
      run.timedOut = true;
      controller.abort();
    }, HITL_TIMEOUT_MS);
    void (async () => {
      try {
        await new ChatApi(httpClientRef.current).resumeHitl(
          agentId,
          { thread_id: threadId, pending_id: pendingId, decisions: [{ type: decision }] },
          frame => {
            // Late frames after abort / unmount are ignored.
            if (controller.signal.aborted) {
              return;
            }
            if (
              frame.type === 'turn.ended' ||
              frame.type === 'done' ||
              frame.type === 'hitl_required'
            ) {
              run.sawTerminal = true;
            }
            handleFrame(frame);
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }
        if (!run.sawTerminal) {
          // Stream closed without a terminal frame — release the busy state.
          handleFrame({ type: 'turn_status', thread_id: threadId, active: false });
        }
      } catch {
        // Unmount aborts silently; a timeout or network error surfaces.
        if (!controller.signal.aborted || run.timedOut) {
          dispatch({ type: 'hitlFailed', message: stringsRef.current.chat.hitlFailed });
        }
      } finally {
        clearTimeout(timeout);
        if (hitlAbortRef.current === controller) {
          hitlAbortRef.current = null;
        }
        decidingRef.current = false;
      }
    })();
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 96;
  };

  const lastTurn = chat.turns.length > 0 ? chat.turns[chat.turns.length - 1] : null;
  const processVisible = chat.process.tools + chat.process.thinking > 0;
  const showHint = chat.turns.length === 0;
  const showTyping =
    chat.streaming && (lastTurn === null || lastTurn.kind === 'user' || lastTurn.kind === 'hitl');
  const footer =
    processVisible || showHint || showTyping ? (
      <View style={styles.footer}>
        {processVisible ? (
          <ProcessCard tools={chat.process.tools} thinking={chat.process.thinking} />
        ) : null}
        {showHint ? (
          <Text style={[styles.hintText, { color: tokens.textTertiary }]}>
            {connection === 'open' ? strings.chat.waiting : strings.chat.connecting}
          </Text>
        ) : null}
        {showTyping ? <TypingDots label={strings.chat.replying} /> : null}
      </View>
    ) : null;

  const renderTurn = ({ item, index }: { item: ChatTurn; index: number }) => {
    switch (item.kind) {
      case 'user':
        return <UserTurnItem text={item.text} attachments={item.attachments} />;
      case 'error': {
        const retryText = item.retryText;
        return (
          <ErrorTurnItem
            text={item.text}
            retryLabel={strings.chat.retrySend}
            onRetry={
              retryText !== undefined
                ? () => retrySend(retryText, item.retryAttachments)
                : undefined
            }
          />
        );
      }
      case 'hitl':
        return (
          <HitlCard
            summary={item.summary}
            detail={item.detail}
            approveLabel={strings.chat.hitlApprove}
            rejectLabel={strings.chat.hitlReject}
            onApprove={() => decideHitl('approve')}
            onReject={() => decideHitl('reject')}
          />
        );
      case 'assistant':
        return (
          <AssistantTurnItem
            text={item.text}
            streaming={chat.streaming && index === chat.turns.length - 1}
            mdStyles={mdStyles}
            mdRules={mdRules}
            onLinkPress={onMarkdownLink}
          />
        );
    }
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
            title={params.title ?? internalPrompt ?? strings.chat.agentName}
            subtitle={headerSubtitle}
            onMenu={openDrawer}
          />
          <FlatList
            ref={scrollRef}
            data={chat.turns}
            keyExtractor={turnKey}
            renderItem={renderTurn}
            ItemSeparatorComponent={TurnSeparator}
            ListFooterComponent={footer ?? undefined}
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
          />
          <View style={styles.inputWrap}>
            <ChatInput
              onSend={sendWithAttachments}
              onPickImages={attachmentFlow.pick}
              pendingAttachments={attachmentFlow.pending}
              onRemovePending={attachmentFlow.remove}
              onStop={stop}
              streaming={chat.streaming || chat.stopRequested}
              canSend={
                !chat.busy &&
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
const UserTurnItem = memo(function UserTurnItem({
  text,
  attachments,
}: {
  text: string;
  attachments?: TurnAttachment[];
}) {
  const names = attachments?.map(a => a.filename ?? a.workspace_path);
  return <UserBubble text={text} attachmentNames={names} />;
});

const AssistantTurnItem = memo(function AssistantTurnItem({
  text,
  streaming,
  mdStyles,
  mdRules,
  onLinkPress,
}: {
  text: string;
  streaming: boolean;
  mdStyles: Record<string, object>;
  mdRules: MdRules;
  onLinkPress: (url: string) => boolean;
}) {
  return (
    <View style={styles.assistantBlock}>
      <Markdown style={mdStyles} rules={mdRules} onLinkPress={onLinkPress}>
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
  detail,
  approveLabel,
  rejectLabel,
  onApprove,
  onReject,
}: {
  summary: string;
  detail?: string;
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
      {detail ? (
        <Text style={[styles.hitlDetail, { color: tokens.textSecondary }]}>{detail}</Text>
      ) : null}
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

function turnKey(turn: ChatTurn): string {
  return turn.id;
}

function TurnSeparator() {
  return <View style={styles.turnSeparator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingTop: 0 },
  fill: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 24,
    paddingBottom: 24,
  },
  turnSeparator: { height: 20 },
  footer: { gap: 20, marginTop: 20 },
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
  hitlDetail: { ...typeScale.footnote },
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
