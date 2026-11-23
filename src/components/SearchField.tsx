import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { CircleX, Search } from 'lucide-react-native';

import { haptics } from '@/platform/haptics';
import { continuousCorners, radius, typeScale, useTokens } from '@/theme';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Screen-reader label for the clear button — icon-only controls need one. */
  clearLabel: string;
  testID?: string;
  autoFocus?: boolean;
}

/**
 * iOS search field: a 36pt rounded fill carrying a magnifier, the query and
 * a clear button, sitting inline with the content it filters.
 *
 * PITFALL (Android + CJK): do NOT try to vertically centre a TextInput's
 * native hint/caret with gravity/height/padding overrides. On Android the
 * CJK hint's ink rides high in its line box and desyncs from the caret, and
 * the caret spans the input's full height — so `textAlignVertical`,
 * `minHeight` and padding tweaks produce a clipped/high hint and a
 * full-box caret, never a centred pair. Verified on-device 2026-11-22.
 *
 * The layout that works instead:
 *  - the empty-state label is an overlay <Text> centred by flexbox
 *    (pointer-transparent so taps focus the input beneath it), not the
 *    native hint;
 *  - the TextInput is pinned to the text line-height (caret = text height)
 *    and centred inside the wrapper;
 *  - the magnifier is centred by the row's alignItems.
 * All three then share the field's vertical centre. Keep it this way.
 * The line-height and field height scale with the system font size, so
 * Larger Text grows the field instead of clipping the query.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  clearLabel,
  testID,
  autoFocus,
}: SearchFieldProps) {
  const t = useTokens();
  const { fontScale } = useWindowDimensions();
  const lineHeight = Math.round(typeScale.body.lineHeight * fontScale);
  // 36pt at the default size: the text line plus 7pt of air above and below.
  const fieldHeight = Math.max(36, lineHeight + 14);
  return (
    <View
      style={[styles.field, continuousCorners, { height: fieldHeight, backgroundColor: t.fill }]}
    >
      <Search size={16} color={t.textTertiary} strokeWidth={2.4} />
      <View style={[styles.inputWrap, { height: fieldHeight }]}>
        <TextInput
          style={[styles.input, { height: lineHeight, color: t.textBody }]}
          value={value}
          onChangeText={onChangeText}
          placeholder=""
          selectionColor={t.accent}
          accessibilityRole="search"
          accessibilityLabel={placeholder}
          testID={testID}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {value.length === 0 ? (
          <Text
            pointerEvents="none"
            numberOfLines={1}
            style={[styles.hint, { color: t.textTertiary }]}
          >
            {placeholder}
          </Text>
        ) : null}
      </View>
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          testID={testID ? `${testID}-clear` : undefined}
          onPress={() => {
            haptics.selection();
            onChangeText('');
          }}
          // 16pt glyph in a comfortable target without growing the field.
          hitSlop={12}
          style={styles.clear}
        >
          <CircleX size={16} color={t.textPlaceholder} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.field,
    paddingHorizontal: 8,
  },
  inputWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    ...typeScale.body,
    padding: 0,
    // The caret spans the input's height on Android; pin it to the text
    // line-height (scaled above) so the cursor is text-height, and let
    // inputWrap centre that line in the field.
    textAlignVertical: 'center',
  },
  hint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    ...typeScale.body,
    textAlignVertical: 'center',
  },
  clear: {
    padding: 2,
  },
});
