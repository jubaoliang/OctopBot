import type { TurnAttachment, UploadResult } from './types';

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

/** Maps the upload response to the content block a `user_turn` references. */
export function toTurnAttachment(result: UploadResult): TurnAttachment {
  return {
    type: result.media_type.startsWith('image/') ? 'image' : 'file',
    workspace_path: result.workspace_path,
    filename: result.filename,
    media_type: result.media_type,
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
