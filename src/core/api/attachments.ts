import type { InboundAttachmentMeta, TurnAttachment, UploadResult, UserTurnFrame } from './types';

/** Where a pick comes from: library allows many images, camera exactly one. */
export type AttachSource = 'library' | 'camera';

/** One composer chip: a local image plus the state of its upload. */
export interface PendingAttachment {
  id: string;
  /** Local file URI — used only for the thumbnail. */
  uri: string;
  filename: string;
  status: 'uploading' | 'ready' | 'failed';
  /** Present once `status === 'ready'`. */
  attachment?: TurnAttachment;
}

/** OpenAI-style content block the dashboard WS turn embeds in `messages`. */
export type UserContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'url'; url: string; media_type?: string };
      preview_url?: string;
      workspace_path: string;
      filename?: string;
    }
  | {
      type: 'file';
      filename: string;
      media_type?: string;
      workspace_path: string;
    };

/** Maps the upload response to the content block a `user_turn` references. */
export function toTurnAttachment(
  result: UploadResult,
  options: { localUri?: string } = {},
): TurnAttachment {
  const preview = result.url || result.access_url;
  return {
    type: result.media_type.startsWith('image/') ? 'image' : 'file',
    workspace_path: result.workspace_path,
    filename: result.filename,
    media_type: result.media_type,
    url: preview,
    local_uri: options.localUri,
  };
}

/** True when a known byte size is over the server cap (unknown sizes pass; the server enforces). */
export function exceedsUploadLimit(byteSize: number | undefined, maxUploadMb: number): boolean {
  return byteSize !== undefined && byteSize > maxUploadMb * 1024 * 1024;
}

/** Ready attachments in order, or `null` when anything is still uploading or failed. */
export function sendableAttachments(
  pending: readonly PendingAttachment[],
): TurnAttachment[] | null {
  const ready: TurnAttachment[] = [];
  for (const item of pending) {
    if (item.status !== 'ready' || !item.attachment) {
      return null;
    }
    ready.push(item.attachment);
  }
  return ready;
}

/** JWT-protected relative preview path for an inbound workspace file. */
export function mediaPreviewPath(
  agentId: string,
  workspacePath: string,
  mediaType?: string,
): string {
  const params = new URLSearchParams({ source: workspacePath });
  if (mediaType) {
    params.set('mime_type', mediaType);
  }
  return `/api/agents/${encodeURIComponent(agentId)}/media/preview?${params.toString()}`;
}

/** Maps history `inbound_attachments` into TurnAttachments the UI already understands. */
export function turnAttachmentsFromInbound(
  agentId: string,
  inbound: readonly InboundAttachmentMeta[] | undefined,
): TurnAttachment[] | undefined {
  if (!inbound || inbound.length === 0) {
    return undefined;
  }
  return inbound.map(item => {
    const kind = item.kind === 'image' || item.media_type.startsWith('image/') ? 'image' : 'file';
    return {
      type: kind,
      workspace_path: item.workspace_path,
      filename: item.filename,
      media_type: item.media_type,
      url: mediaPreviewPath(agentId, item.workspace_path, item.media_type),
    };
  });
}

/**
 * Build OpenAI-style user content for a dashboard turn.
 * Images → vision blocks; other files → `type: file` (path hints applied server-side).
 */
export function buildUserMessageContent(
  text: string,
  attachments: readonly TurnAttachment[] = [],
): string | UserContentBlock[] {
  const blocks: UserContentBlock[] = [];
  const trimmed = text.trim();
  if (trimmed) {
    blocks.push({ type: 'text', text: trimmed });
  }
  for (const attachment of attachments) {
    if (attachment.type === 'image') {
      // Server materializes vision from `workspace_path`; preview URL is for UI.
      const preview = attachment.url ?? '';
      blocks.push({
        type: 'image',
        source: {
          type: 'url',
          url: preview,
          ...(attachment.media_type ? { media_type: attachment.media_type } : {}),
        },
        ...(preview ? { preview_url: preview } : {}),
        workspace_path: attachment.workspace_path,
        ...(attachment.filename ? { filename: attachment.filename } : {}),
      });
    } else {
      blocks.push({
        type: 'file',
        filename: attachment.filename ?? 'attachment',
        workspace_path: attachment.workspace_path,
        ...(attachment.media_type ? { media_type: attachment.media_type } : {}),
      });
    }
  }
  if (blocks.length === 0) {
    return '';
  }
  if (blocks.length === 1 && blocks[0].type === 'text') {
    return blocks[0].text;
  }
  return blocks;
}

/** Wire shape after convenience `attachments` are folded into `messages`. */
export type SerializedUserTurn = Omit<UserTurnFrame, 'type' | 'attachments'>;

/**
 * Rewrites a convenience `attachments` list into the `messages[].content`
 * blocks the Octop server actually reads. Top-level `attachments` are dropped
 * (Pydantic ChatTurnBody ignores them).
 */
export function serializeUserTurn(frame: Omit<UserTurnFrame, 'type'>): SerializedUserTurn {
  const { attachments, text, messages, ...rest } = frame;
  if (!attachments || attachments.length === 0) {
    return { ...rest, text, ...(messages ? { messages } : {}) };
  }
  // Strip client-only local_uri before anything reaches the wire.
  const wireAttachments = attachments.map(({ local_uri: _local, ...att }) => att);
  const content = buildUserMessageContent(text ?? '', wireAttachments);
  const trimmed = (text ?? '').trim();
  return {
    ...rest,
    ...(trimmed ? { text: trimmed } : {}),
    messages: [{ role: 'user', content }],
  };
}
