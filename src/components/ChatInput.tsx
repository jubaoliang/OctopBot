import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutRectangle,
} from 'react-native';
import { useRef, useState, type ElementRef } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Svg, Path, Rect } from 'react-native-svg';
import { X } from 'lucide-react-native';

import { IconButton } from '@/components/IconButton';
import { IconMic, IconPlus } from '@/components/icons';
import { PopoverMenu } from '@/components/PopoverMenu';
import type { AttachSource, PendingAttachment } from '@/core/api/attachments';
import type { TurnAttachment } from '@/core/api/types';
import { useVoiceInput } from '@/features/useVoiceInput';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { RemoteImage } from '@/platform/remote-image';
import { continuousCorners, radius, typeScale, useTokens } from '@/theme';

interface ChatInputProps {
  /**
   * Composing state swaps the stop/send button (per design). Attachments
   * are the already-uploaded chips; omitted for a text-only send.
   */
  onSend?: (text: string, attachments?: TurnAttachment[]) => void;
  /** Leading + opens a source chooser, then calls this. Omit to hide the button. */
  onPickImages?: (source: AttachSource) => void;
  /** Chips above the field; the screen owns upload state. */
  pendingAttachments?: PendingAttachment[];
  onRemovePending?: (id: string) => void;
  /** Shown while a turn is streaming — cancels the active turn. */
  onStop?: () => void;
  streaming?: boolean;
  /** When false the send glyph is dimmed; the field still accepts text. */
  canSend?: boolean;
}

// Module scope: layout-animation builders are not rebuilt per render. Only
// an entrance — an exiting glyph would hold its slot and shove the field.
const SWAP_IN = FadeIn.duration(150);

/** Visual frame of the trailing glyph button; hitSlop makes it 44pt. */
const GLYPH_FRAME = 28;

/**
 * Chat composer: field + mic / send / stop. Voice uses hybrid STT
 * (system dictation by default; cloud upload when `active.stt` is set).
 * Attach uses PopoverMenu (HIG pull-down), not ActionSheet.
 */
export function ChatInput({
  onSend,
  onStop,
  streaming = false,
  canSend = true,
  onPickImages,
  pendingAttachments,
  onRemovePending,
}: ChatInputProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const [text, setText] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachAnchor, setAttachAnchor] = useState<LayoutRectangle | null>(null);
  const attachRef = useRef<ElementRef<typeof View>>(null);
  const baseBeforeVoice = useRef('');
  const pending = pendingAttachments ?? [];
  const hasPending = pending.length > 0;
  const uploading = pending.some(item => item.status === 'uploading');
  const failed = pending.some(item => item.status === 'failed');
  // Chips make the message sendable without text; a text-only send is only
  // allowed when there are no chips, and nothing sends while one is in flight.
  const composing = text.trim().length > 0 || hasPending;
  const attachmentsReady = !uploading && !failed;

  const mergeVoice = (spoken: string, interim: boolean) => {
    const base = baseBeforeVoice.current;
    const joined = base ? `${base}${base.endsWith(' ') || !spoken ? '' : ' '}${spoken}` : spoken;
    setText(joined);
    if (!interim) {
      baseBeforeVoice.current = joined;
    }
  };

  const voice = useVoiceInput({
    onStart: () => {
      baseBeforeVoice.current = text;
    },
    onInterim: spoken => {
      mergeVoice(spoken, true);
    },
    onText: spoken => {
      mergeVoice(spoken, false);
    },
  });

  const submit = () => {
    if (!composing || !canSend || !attachmentsReady || streaming || voice.busy) {
      return;
    }
    haptics.impact('light');
    const ready = pending.flatMap(item => (item.attachment ? [item.attachment] : []));
    onSend?.(text.trim(), ready.length > 0 ? ready : undefined);
    setText('');
    baseBeforeVoice.current = '';
  };

  const stop = () => {
    haptics.impact('medium');
    onStop?.();
  };

  const onAttach = () => {
    haptics.impact('light');
    // HIG pull-down menu next to + (disambiguation), not a bottom sheet.
    attachRef.current?.measureInWindow((x, y, width, height) => {
      setAttachAnchor({ x, y, width, height });
      setAttachMenuOpen(true);
    });
  };

  const pickSource = (source: AttachSource) => {
    onPickImages?.(source);
  };

  const onMic = () => {
    haptics.impact('light');
    voice.toggle();
  };

  const trailing = (() => {
    if (streaming) {
      return (
        <Animated.View key="stop" entering={SWAP_IN}>
          <IconButton
            label={strings.a11y.stop}
            testID="composer-stop"
            size={GLYPH_FRAME}
            onPress={stop}
          >
            <View style={[styles.sendDisc, { backgroundColor: t.textPrimary }]}>
              <StopGlyph color={t.textInverse} />
            </View>
          </IconButton>
        </Animated.View>
      );
    }
    if (voice.busy) {
      return (
        <Animated.View key="mic-active" entering={SWAP_IN}>
          <IconButton
            label={strings.a11y.voice}
            testID="composer-voice"
            size={GLYPH_FRAME}
            onPress={onMic}
          >
            <View style={[styles.sendDisc, { backgroundColor: t.danger }]}>
              <IconMic width={16} height={16} color={t.textInverse} />
            </View>
          </IconButton>
        </Animated.View>
      );
    }
    if (composing) {
      return (
        <Animated.View key="send" entering={SWAP_IN}>
          <IconButton
            label={strings.a11y.send}
            testID="composer-send"
            size={GLYPH_FRAME}
            disabled={!canSend || !attachmentsReady}
            onPress={submit}
          >
            <View
              style={[
                styles.sendDisc,
                { backgroundColor: t.accent, opacity: canSend && attachmentsReady ? 1 : 0.4 },
              ]}
            >
              <SendGlyph color={t.textInverse} />
            </View>
          </IconButton>
        </Animated.View>
      );
    }
    return (
      <Animated.View key="mic" entering={SWAP_IN}>
        <IconButton
          label={strings.a11y.voice}
          testID="composer-voice"
          size={GLYPH_FRAME}
          onPress={onMic}
        >
          <IconMic width={22} height={22} color={t.textSecondary} />
        </IconButton>
      </Animated.View>
    );
  })();

  return (
    <View style={[styles.card, { backgroundColor: t.surface, shadowColor: t.shadow }]}>
      {hasPending ? (
        <ScrollView
          horizontal
          style={styles.chips}
          contentContainerStyle={styles.chipsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {pending.map(item => (
            <PendingChip
              key={item.id}
              item={item}
              removeLabel={strings.attachments.remove}
              statusLabel={
                item.status === 'uploading'
                  ? strings.attachments.uploading
                  : item.status === 'failed'
                    ? strings.attachments.failed
                    : undefined
              }
              onRemove={onRemovePending}
            />
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.bar}>
        {onPickImages ? (
          <View ref={attachRef} collapsable={false}>
            <IconButton
              label={strings.a11y.attach}
              testID="composer-attach"
              size={GLYPH_FRAME}
              disabled={streaming || voice.busy}
              onPress={onAttach}
            >
              <IconPlus width={22} height={22} color={t.textSecondary} />
            </IconButton>
          </View>
        ) : null}
        <TextInput
          style={[styles.input, { color: t.textBody }]}
          placeholder={
            voice.recording
              ? strings.voice.listening
              : voice.transcribing
                ? strings.voice.transcribing
                : strings.chatHome.inputPlaceholder
          }
          placeholderTextColor={t.textPlaceholder}
          selectionColor={t.accent}
          value={text}
          onChangeText={setText}
          multiline
          editable={!streaming && !voice.busy}
          onSubmitEditing={submit}
          testID="composer-input"
        />
        {trailing}
      </View>
      <PopoverMenu
        visible={attachMenuOpen}
        anchor={attachAnchor}
        onClose={() => setAttachMenuOpen(false)}
        dismissLabel={strings.common.cancel}
        testID="composer-attach-menu"
        items={[
          {
            label: strings.attachments.library,
            testID: 'composer-attach-library',
            onPress: () => pickSource('library'),
          },
          {
            label: strings.attachments.camera,
            testID: 'composer-attach-camera',
            onPress: () => pickSource('camera'),
          },
        ]}
      />
    </View>
  );
}

/** Thumbnail chip with upload state overlay and a remove control. */
function PendingChip({
  item,
  removeLabel,
  statusLabel,
  onRemove,
}: {
  item: PendingAttachment;
  removeLabel: string;
  statusLabel?: string;
  onRemove?: (id: string) => void;
}) {
  const t = useTokens();
  return (
    <View
      testID={`composer-pending-${item.id}`}
      style={[
        styles.chip,
        {
          backgroundColor: t.overlaySubtle,
          borderColor: item.status === 'failed' ? t.danger : t.borderSubtle,
        },
      ]}
    >
      <RemoteImage
        uri={item.uri}
        style={styles.thumb}
        contentFit="cover"
        accessibilityLabel={statusLabel ? `${item.filename}, ${statusLabel}` : item.filename}
      />
      {item.status === 'uploading' ? (
        <View style={[styles.thumbOverlay, { backgroundColor: t.scrim }]}>
          <ActivityIndicator color={t.textInverse} />
        </View>
      ) : null}
      {item.status === 'failed' ? (
        <View style={[styles.thumbOverlay, { backgroundColor: t.dangerSoft }]}>
          <Text style={[styles.failedMark, { color: t.danger }]}>!</Text>
        </View>
      ) : null}
      <View style={styles.chipRemove}>
        <IconButton
          label={removeLabel}
          testID={`composer-pending-remove-${item.id}`}
          size={20}
          onPress={() => onRemove?.(item.id)}
        >
          <View style={[styles.removeDisc, { backgroundColor: t.textPrimary }]}>
            <X size={12} color={t.textInverse} />
          </View>
        </IconButton>
      </View>
    </View>
  );
}

/** Paper-plane glyph matching the design's send icon. */
function SendGlyph({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16">
      <Path
        fill={color}
        d="M14.2 1.8 1.9 6.6c-.6.24-.57 1.1.05 1.3l4.9 1.63 1.64 4.9c.2.62 1.06.65 1.3.05l4.8-12.3a.7.7 0 0 0-.9-.9Z"
      />
    </Svg>
  );
}

/** Stop square inside the trailing disc while a turn streams. */
function StopGlyph({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Rect x={2} y={2} width={8} height={8} rx={1.5} fill={color} />
    </Svg>
  );
}

/** Square thumbnail edge. */
const THUMB = 56;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.input,
    ...continuousCorners,
    // Design: soft 32-radius ambient shadow.
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 2,
  },
  bar: {
    flexDirection: 'row',
    // Buttons stay on the last line while the field grows upward.
    alignItems: 'flex-end',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  chips: {
    flexGrow: 0,
  },
  chipsContent: {
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    // Room for the remove control that overhangs the thumbnail corner.
    paddingRight: 18,
  },
  chip: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
    // Visible so the remove control can overhang; the image clips itself.
    overflow: 'visible',
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: radius.pill,
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedMark: {
    ...typeScale.headline,
  },
  chipRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  removeDisc: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    ...typeScale.body,
    // Five lines of body text, then the field scrolls.
    maxHeight: 22 * 5,
    minHeight: GLYPH_FRAME,
    paddingTop: 3,
    paddingBottom: 3,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
  },
  sendDisc: {
    width: GLYPH_FRAME,
    height: GLYPH_FRAME,
    borderRadius: GLYPH_FRAME / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
