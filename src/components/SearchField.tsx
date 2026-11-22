import { Pressable, StyleSheet, TextInput, View } from 'react-native';
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
 * a clear button, sitting inline with the content it filters
 * (search-fields.md › Phone: search "directly inline with content").
 *
 * Filtering happens on every keystroke — the guidance is to start search as
 * soon as a person types, so results refine instead of waiting for a submit.
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
  return (
    <View style={[styles.field, continuousCorners, { backgroundColor: t.fill }]}>
      {/* CJK fonts carry large descent slack, so the glyphs ride high in
          their line box while the icon stays at box centre — nudge the
          magnifier up to meet the ink's optical centre. */}
      <Search size={16} color={t.textTertiary} strokeWidth={2.4} style={styles.icon} />
      <TextInput
        style={[styles.input, { color: t.textBody }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textTertiary}
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
    minHeight: 36,
    borderRadius: radius.field,
    paddingHorizontal: 8,
  },
  icon: {
    transform: [{ translateY: -2 }],
  },
  input: {
    flex: 1,
    ...typeScale.body,
    // 36pt box, 17pt text: no vertical padding or the glyph box drifts.
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 36,
    // Android top-aligns text in a fixed-height field by default, which
    // leaves the placeholder above the row-centered magnifier; center it.
    textAlignVertical: 'center',
  },
  clear: {
    padding: 2,
  },
});
