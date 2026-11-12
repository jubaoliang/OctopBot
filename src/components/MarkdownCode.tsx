import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useMemo } from 'react';

import { CODE_FONT } from '@/theme/code-font';
import { resolveSyntaxColors } from '@/theme/syntax-colors';
import { continuousCorners, radius, typeScale, useTheme } from '@/theme';
import { highlightToSpans, type SyntaxRole, type SyntaxSpan } from '@/utils/syntax-highlight';

/**
 * Fenced code block for chat markdown: monospace, selectable, horizontally
 * scrollable, with theme-aware syntax highlighting.
 */
export function CodeFence({ code, language }: { code: string; language?: string }) {
  const { tokens, resolvedMode } = useTheme();
  const body = code.replace(/\n$/, '');
  const spans = useMemo(() => highlightToSpans(body, language), [body, language]);
  const colors = useMemo(() => resolveSyntaxColors(tokens, resolvedMode), [tokens, resolvedMode]);

  return (
    <View
      style={[
        styles.fence,
        {
          backgroundColor: tokens.overlaySubtle,
          borderColor: tokens.borderSubtle,
        },
      ]}
    >
      {language ? (
        <Text style={[styles.lang, { color: tokens.textTertiary }]} numberOfLines={1}>
          {language}
        </Text>
      ) : null}
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Text selectable style={[styles.code, { color: colors.plain, fontFamily: CODE_FONT }]}>
          {spans.map((span, index) => (
            <SyntaxChunk key={index} span={span} colors={colors} />
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * Inline ``code`` chip — must stay a Text (paragraph nesting). Stronger
 * fill than overlaySubtle so the chip reads on white, plus monospace so
 * ``pi`` never looks like body copy.
 */
export function InlineCode({
  text,
  inheritedStyle,
}: {
  text: string;
  inheritedStyle?: StyleProp<TextStyle>;
}) {
  const { tokens } = useTheme();
  // Strip the paragraph face/weight so Android cannot keep the body font.
  const base = StyleSheet.flatten(inheritedStyle) ?? {};
  const { fontFamily: _dropFace, fontWeight: _dropWeight, ...lineMetrics } = base;
  return (
    <Text
      selectable
      style={[
        lineMetrics,
        styles.inline,
        {
          color: tokens.textSecondary,
          backgroundColor: tokens.overlayPressed,
          fontFamily: CODE_FONT,
          fontWeight: '400',
          fontStyle: 'normal',
          borderRadius: radius.chip,
          overflow: 'hidden',
        },
      ]}
    >
      {text}
    </Text>
  );
}

function SyntaxChunk({ span, colors }: { span: SyntaxSpan; colors: Record<SyntaxRole, string> }) {
  return <Text style={{ color: colors[span.role], fontFamily: CODE_FONT }}>{span.text}</Text>;
}

const styles = StyleSheet.create({
  fence: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    ...continuousCorners,
    padding: 12,
    marginVertical: 6,
    gap: 6,
  },
  lang: {
    ...typeScale.caption2,
    textTransform: 'lowercase',
  },
  code: {
    ...typeScale.footnote,
  },
  inline: {
    ...typeScale.subheadline,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});
