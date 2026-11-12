import { StyleSheet, TextInput, View } from 'react-native';
import { useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Svg, Path } from 'react-native-svg';

import { IconButton } from '@/components/IconButton';
import { IconMic, IconPlus } from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { continuousCorners, radius, typeScale, useTokens } from '@/theme';

interface ChatInputProps {
  /** Composing state swaps the mic for the send button (per design). */
  onSend?: (text: string) => void;
}

// Module scope: layout-animation builders are not rebuilt per render. Only
// an entrance — an exiting glyph would hold its slot and shove the field.
const SWAP_IN = FadeIn.duration(150);

/** Visual frame of the trailing/leading glyph buttons; hitSlop makes it 44pt. */
const GLYPH_FRAME = 28;

/**
 * Chat composer per design: white bar, radius 12, gap 12 — plus button,
 * placeholder, mic (idle) or send (composing). Text is the iOS body size
 * and the field grows to five lines before it scrolls.
 */
export function ChatInput({ onSend }: ChatInputProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const [text, setText] = useState('');
  const composing = text.trim().length > 0;

  const submit = () => {
    if (!composing) {
      return;
    }
    haptics.impact('light');
    onSend?.(text.trim());
    setText('');
  };

  return (
    <View style={[styles.bar, { backgroundColor: t.surface, shadowColor: t.shadow }]}>
      <IconButton label={strings.a11y.attach} testID="composer-attach" size={GLYPH_FRAME}>
        <IconPlus width={20} height={20} color={t.textBody} />
      </IconButton>
      <TextInput
        style={[styles.input, { color: t.textBody }]}
        placeholder={strings.chatHome.inputPlaceholder}
        placeholderTextColor={t.textPlaceholder}
        selectionColor={t.accent}
        value={text}
        onChangeText={setText}
        multiline
        onSubmitEditing={submit}
      />
      {composing ? (
        <Animated.View key="send" entering={SWAP_IN}>
          <IconButton
            label={strings.a11y.send}
            testID="composer-send"
            size={GLYPH_FRAME}
            onPress={submit}
          >
            <View style={[styles.sendDisc, { backgroundColor: t.accent }]}>
              <SendGlyph color={t.textInverse} />
            </View>
          </IconButton>
        </Animated.View>
      ) : (
        <Animated.View key="voice" entering={SWAP_IN}>
          <IconButton label={strings.a11y.voice} testID="composer-voice" size={GLYPH_FRAME}>
            <IconMic width={20} height={20} color={t.textBody} />
          </IconButton>
        </Animated.View>
      )}
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
