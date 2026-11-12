import type { TurnAttachment } from '@/core/api/types';

/** First message composed on the chat home, auto-sent by the thread screen. */
export interface ChatHandoff {
  id: string;
  text: string;
  attachments: TurnAttachment[];
}

// Single in-memory slot. Attachments never travel through route params, so a
// forged deep link cannot reference workspace files or trigger an auto-send.
let slot: ChatHandoff | null = null;
let counter = 0;

/** Stores the handoff and returns the id to pass as the `handoff` route param. */
export function putChatHandoff(text: string, attachments: TurnAttachment[]): string {
  counter += 1;
  const id = `h${counter}`;
  slot = { id, text, attachments };
  return id;
}

/** Non-consuming peek (unknown ids resolve to null). */
export function getChatHandoff(id: string | undefined): ChatHandoff | null {
  return id && slot?.id === id ? slot : null;
}

/** Consuming take — clears the slot so remounts cannot re-send. */
export function takeChatHandoff(id: string | undefined): ChatHandoff | null {
  const hit = getChatHandoff(id);
  if (hit) {
    slot = null;
  }
  return hit;
}
