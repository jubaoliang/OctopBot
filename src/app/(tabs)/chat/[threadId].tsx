import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { ChatInput } from '@/components/ChatInput';
import { ProcessCard, UserBubble } from '@/components/ChatPieces';
import { readableText, ThreadsApi } from '@/core/api/threads';
import type { ServerFrame } from '@/core/api/types';
import { ChatSocket, type ChatConnectionStatus } from '@/core/chat/chat-socket';
import { useAppShell } from '@/features/app-shell';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme';

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
  // Fresh token for the socket factory; sliding renewals land here.
  const tokenRef = useRef<string | null>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  // Defaults to the default expert on a fresh server install.
  const agentId = params.agent ?? 'main';

  const handleFrame = useCallback((frame: ServerFrame) => {
    switch (frame.type) {
      case 'token': {
        // The forward-compat union member also matches 'token'; narrow it.
        const delta = (frame as { content?: unknown }).content;
        if (typeof delta === 'string') {
          setStreaming(true);
          setTurns(prev => appendAssistant(prev, delta));
        }
        break;
      }
      case 'reasoning':
        setThinkingCount(c => c + 1);
        break;
      case 'tool_call_chunk':
        setToolCount(c => c + 1);
        break;
      case 'turn.started':
        setStreaming(true);
        break;
      case 'turn.ended':
      case 'done':
        setStreaming(false);
        break;
      case 'error': {
        const message = (frame as { message?: unknown }).message;
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
  }, []);

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
      <View style={[styles.safe, { paddingBottom: tabBarFootprint }]}>
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
        >
          {turns.map((turn, index) =>
            turn.role === 'user' ? (
              <UserBubble key={`u-${index}`} text={turn.text} />
            ) : (
              <Text key={`a-${index}`} style={[styles.assistantText, { color: tokens.textBody }]}>
                {turn.text}
                {streaming && index === turns.length - 1 ? (
                  <Text style={{ color: tokens.textTertiary }}> ▍</Text>
                ) : null}
              </Text>
            ),
          )}
          {toolCount + thinkingCount > 0 ? (
            <ProcessCard tools={toolCount} thinking={thinkingCount} />
          ) : null}
          {turns.length === 0 ? (
            <Text style={[styles.assistantText, { color: tokens.textTertiary }]}>
              {connection === 'open' ? strings.chat.waiting : strings.chat.connecting}
            </Text>
          ) : null}
          {streaming && (turns.length === 0 || turns[turns.length - 1].role === 'user') ? (
            <Text style={[styles.assistantText, { color: tokens.textTertiary }]}>···</Text>
          ) : null}
        </ScrollView>
        <View style={styles.inputWrap}>
          <ChatInput onSend={send} />
        </View>
      </View>
    </View>
  );
}

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
  safe: { flex: 1, paddingTop: 47 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 33,
    gap: 20,
    paddingBottom: 24,
  },
  assistantText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  },
  inputWrap: { paddingHorizontal: 16 },
});
