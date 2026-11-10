import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Svg, Path } from 'react-native-svg';

import { IconMic, IconPlus } from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { useTokens } from '@/theme';

interface ChatInputProps {
  /** Composing state swaps the mic for the send button (per design). */
  onSend?: (text: string) => void;
}

/**
 * Chat composer per design: white bar, radius 12, padding 12/16, gap 12 —
 * plus button, placeholder 14/22 at 30%, mic (idle) or send (composing).
 */
export function ChatInput({ onSend }: ChatInputProps) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const [text, setText] = useState('');
  const composing = text.trim().length > 0;

  return (
    <View style={[styles.bar, { backgroundColor: t.surface, shadowColor: t.shadow }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="add" style={styles.plusButton}>
        <IconPlus width={20} height={20} color={t.textBody} />
      </Pressable>
      <TextInput
        style={[styles.input, { color: t.textBody }]}
        placeholder={strings.chatHome.inputPlaceholder}
        placeholderTextColor={t.textPlaceholder}
        value={text}
        onChangeText={setText}
        multiline
        onSubmitEditing={() => {
          if (composing) {
            onSend?.(text.trim());
            setText('');
          }
        }}
      />
      {composing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="send"
          style={[styles.sendButton, { backgroundColor: t.overlaySubtle }]}
          onPress={() => {
            onSend?.(text.trim());
            setText('');
          }}
        >
          <SendGlyph color={t.textBody} />
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="voice" style={styles.iconButton}>
          <IconMic width={20} height={20} color={t.textBody} />
        </Pressable>
      )}
    </View>
  );
}

/** Paper-plane glyph matching the design's send icon. */
function SendGlyph({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
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
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    // Design: soft 32-radius ambient shadow.
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 2,
  },
  plusButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    padding: 0,
    fontWeight: '400',
  },
  iconButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
