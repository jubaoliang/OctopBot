import type { AttachSource } from '@/core/api/attachments';

/** Props shared by the drawn (default) and system (iOS) attach controls. */
export interface AttachButtonProps {
  onPick: (source: AttachSource) => void;
  disabled?: boolean;
}
