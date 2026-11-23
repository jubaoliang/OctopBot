import { createContext, useContext } from 'react';

import type { ChatConnectionStatus } from '@/core/chat/chat-socket';
import type { ClientFrame, ServerFrame } from '@/core/api/types';

/**
 * Isolated from `session-socket.tsx` so Fast Refresh of provider logic does
 * not recreate the context object (which would make consumers see `null`).
 */

export interface SessionSocketValue {
  /** Connection state of the one always-on socket (pushes + device presence). */
  status: ChatConnectionStatus;
  /** Sends a frame; false when the socket is not open. */
  send: (frame: ClientFrame) => boolean;
  /** Receives every inbound frame; returns an unsubscribe function. */
  subscribe: (handler: (frame: ServerFrame) => void) => () => void;
  /** Foreground return: probe now, or reconnect instead of waiting out backoff. */
  resume: () => void;
  /** Opens the socket when it was closed (initial connect, terminal recovery). */
  connect: () => Promise<void>;
}

export const SessionSocketContext = createContext<SessionSocketValue | null>(null);

export function useSessionSocket(): SessionSocketValue {
  const value = useContext(SessionSocketContext);
  if (!value) {
    throw new Error('useSessionSocket must be used inside SessionSocketProvider');
  }
  return value;
}
