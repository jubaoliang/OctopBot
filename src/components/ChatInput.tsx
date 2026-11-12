import { StyleSheet, TextInput, View } from 'react-native';
import { useRef, useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Svg, Path, Rect } from 'react-native-svg';

import { IconButton } from '@/components/IconButton';
import { IconMic } from '@/components/icons';
import { useVoiceInput } from '@/features/useVoiceInput';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { continuousCorners, radius, typeScale, useTokens } from '@/theme';

interface ChatInputProps {
  /** Composing state swaps the stop/send button (per design). */
  onSend?: (text: string) => void;
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
 */
export function ChatInput({ onSend, onStop, streaming = false, canSend = true }: ChatInputProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const [text, setText] = useState('');
  const baseBeforeVoice = useRef('');
  const composing = text.trim().length > 0;

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
    if (!composing || !canSend || streaming || voice.busy) {
      return;
    }
    haptics.impact('light');
    onSend?.(text.trim());
    setText('');
    baseBeforeVoice.current = '';
  };

  const stop = () => {
    haptics.impact('medium');
    onStop?.();
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
            disabled={!canSend}
            onPress={submit}
          >
            <View
              style={[styles.sendDisc, { backgroundColor: t.accent, opacity: canSend ? 1 : 0.4 }]}
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
    <View style={[styles.bar, { backgroundColor: t.surface, shadowColor: t.shadow }]}>
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

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    // Buttons stay on the last line while the field grows upward.
    alignItems: 'flex-end',
    gap: 8,
    minHeight: 48,
    borderRadius: radius.input,
    ...continuousCorners,
    paddingHorizontal: 10,
    paddingVertical: 10,
    // Design: soft 32-radius ambient shadow.
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 2,
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
