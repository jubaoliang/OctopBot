import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ChatSocket, type ChatConnectionStatus } from '@/core/chat/chat-socket';
import type { ClientFrame, ServerFrame } from '@/core/api/types';
import { useAuth } from '@/features/auth';
import { SessionSocketContext, type SessionSocketValue } from '@/features/session-socket-context';

type FrameHandler = (frame: ServerFrame) => void;

/**
 * The app's one always-on connection while signed in. Everything that must
 * outlive a screen rides it, multiplexed by frame `type`: server pushes
 * (`dashboard_push`) and the phone's device presence (`device_tools.*`,
 * `device_tool_call`). One heartbeat and one reconnect loop instead of one
 * per concern — the per-thread chat socket stays separate because it only
 * exists while a thread screen is mounted, so it costs no background battery.
 */
export function SessionSocketProvider({ children }: { children: ReactNode }) {
  const { baseUrl, token, user, ready, sessionGeneration } = useAuth();
  const [status, setStatus] = useState<ChatConnectionStatus>('idle');
  const socketRef = useRef<ChatSocket | null>(null);
  const handlersRef = useRef(new Set<FrameHandler>());
  // Mirrors the auth token so every (re)connect reads the latest value —
  // sliding renewal must not require a socket rebuild (auth.tsx pattern).
  const tokenRef = useRef<string | null>(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!ready || !user || !baseUrl) {
      return;
    }
    const socket = new ChatSocket({
      baseUrl,
      path: '/api/notifications/ws',
      name: 'session',
      tokenFactory: () => Promise.resolve(tokenRef.current),
      onFrame: frame => {
        for (const handler of handlersRef.current) {
          handler(frame);
        }
      },
      onStatus: setStatus,
    });
    socketRef.current = socket;
    // connect() reports 'connecting' through onStatus; no eager setState here.
    void socket.connect().catch(() => undefined);
    return () => {
      socket.close();
      socketRef.current = null;
    };
    // sessionGeneration joins the key so logout / account switch rebuilds.
  }, [ready, user, baseUrl, sessionGeneration]);

  // Foreground return: the OS suspends idle sockets in the background, so a
  // phone that comes back would look offline until the heartbeat notices.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        return;
      }
      const socket = socketRef.current;
      if (!socket) {
        return;
      }
      socket.resume();
      if (socket.status === 'closed') {
        void socket.connect().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, []);

  const send = useCallback(
    (frame: ClientFrame) => socketRef.current?.sendFrame(frame) ?? false,
    [],
  );

  const subscribe = useCallback((handler: FrameHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const resume = useCallback(() => {
    socketRef.current?.resume();
  }, []);

  const connect = useCallback(async () => {
    await socketRef.current?.connect();
  }, []);

  const value = useMemo<SessionSocketValue>(
    () => ({ status, send, subscribe, resume, connect }),
    [status, send, subscribe, resume, connect],
  );

  return <SessionSocketContext.Provider value={value}>{children}</SessionSocketContext.Provider>;
}
