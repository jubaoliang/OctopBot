import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Copy, Maximize2, WrapText, X } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { useI18n } from '@/i18n/I18nProvider';
import { copyText } from '@/platform/clipboard';
import { CODE_FONT } from '@/theme/code-font';
import { resolveSyntaxColors } from '@/theme/syntax-colors';
import { continuousCorners, layout, radius, typeScale, useTheme } from '@/theme';
import { highlightToSpans, type SyntaxRole, type SyntaxSpan } from '@/utils/syntax-highlight';

/** Code text metrics — near-body size, roomy leading (fences are reading text). */
const CODE_TEXT = { fontFamily: CODE_FONT, fontSize: 14, lineHeight: 21 } as const;
/** Conversation fences clip past this many lines; the viewer shows the rest. */
const CLIP_LINES = 9;

/**
 * Fenced code block for chat markdown, per the Doubao benchmark: a visible
 * surface card with a hairline edge, a header band carrying the language and
 * copy / expand actions, near-body monospace, and long blocks clipped behind
 * a fade into a full-screen viewer (line numbers + wrap toggle).
 */
export function CodeFence({ code, language }: { code: string; language?: string }) {
  const { tokens, resolvedMode } = useTheme();
  const { t: strings } = useI18n();
  const [viewerOpen, setViewerOpen] = useState(false);
  const body = code.replace(/\n$/, '');
  const spans = useMemo(() => highlightToSpans(body, language), [body, language]);
  const colors = useMemo(() => resolveSyntaxColors(tokens, resolvedMode), [tokens, resolvedMode]);
  const lineCount = useMemo(() => body.split('\n').length, [body]);
  const clipped = lineCount > CLIP_LINES;

  return (
    <View
      style={[
        styles.fence,
        continuousCorners,
        { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: tokens.borderSubtle }]}>
        <Text style={[styles.lang, { color: tokens.textSecondary }]} numberOfLines={1}>
          {language ?? strings.code.plain}
        </Text>
        <View style={styles.headerActions}>
          <CopyButton code={body} />
          <IconButton
            label={strings.code.showAll}
            size={32}
            onPress={() => setViewerOpen(true)}
            testID="code-expand"
          >
            <Maximize2 size={16} color={tokens.textSecondary} strokeWidth={1.8} />
          </IconButton>
        </View>
      </View>
      <View style={clipped ? { maxHeight: CLIP_LINES * CODE_TEXT.lineHeight + 24 } : null}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.codePad}
        >
          <Text selectable style={[CODE_TEXT, { color: colors.plain }]}>
            {spans.map((span, index) => (
              <SyntaxChunk key={index} span={span} colors={colors} />
            ))}
          </Text>
        </ScrollView>
        {clipped ? (
          <View pointerEvents="none" style={styles.fade}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={tokens.surface} stopOpacity="0" />
                  <Stop offset="1" stopColor={tokens.surface} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
            </Svg>
          </View>
        ) : null}
      </View>
      {clipped ? (
        <PressableScale
          accessibilityRole="button"
          style={[styles.showAll, { borderTopColor: tokens.borderSubtle }]}
          onPress={() => setViewerOpen(true)}
          testID="code-show-all"
        >
          <Text style={[styles.showAllLabel, { color: tokens.textSecondary }]}>
            {strings.code.showAll}
          </Text>
        </PressableScale>
      ) : null}
      <CodeViewer
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
        code={body}
        language={language}
        spans={spans}
        colors={colors}
      />
    </View>
  );
}

/** Copy with a transient check swap — feedback comes from the write landing. */
function CopyButton({ code, size = 32 }: { code: string; size?: number }) {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      label={copied ? strings.code.copied : strings.code.copy}
      size={size}
      onPress={() => {
        void copyText(code).then(ok => {
          if (!ok) {
            return;
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      testID="code-copy"
    >
      {copied ? (
        <Check size={16} color={tokens.success} strokeWidth={2} />
      ) : (
        <Copy size={16} color={tokens.textSecondary} strokeWidth={1.8} />
      )}
    </IconButton>
  );
}

/**
 * Full-screen code viewer: line-number gutter synced by a shared vertical
 * scroll, horizontal scroll or wrap by toggle, copy and close in the header.
 */
function CodeViewer({
  visible,
  onClose,
  code,
  language,
  spans,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  code: string;
  language?: string;
  spans: SyntaxSpan[];
  colors: Record<SyntaxRole, string>;
}) {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const insets = useSafeAreaInsets();
  const [wrap, setWrap] = useState(false);
  const numbers = useMemo(
    () =>
      code
        .split('\n')
        .map((_, index) => index + 1)
        .join('\n'),
    [code],
  );
  const codeText = (
    <Text selectable style={[CODE_TEXT, { color: colors.plain }]}>
      {spans.map((span, index) => (
        <SyntaxChunk key={index} span={span} colors={colors} />
      ))}
    </Text>
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.viewer, { backgroundColor: tokens.surface, paddingTop: insets.top }]}>
        <View style={[styles.viewerHeader, { borderBottomColor: tokens.borderSubtle }]}>
          <Text style={[styles.viewerTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
            {language ?? strings.code.plain}
          </Text>
          <View style={styles.headerActions}>
            <IconButton
              label={strings.code.wrap}
              size={36}
              onPress={() => setWrap(w => !w)}
              testID="code-wrap"
            >
              <WrapText
                size={18}
                color={wrap ? tokens.accent : tokens.textSecondary}
                strokeWidth={1.8}
              />
            </IconButton>
            <CopyButton code={code} size={36} />
            <IconButton
              label={strings.common.close}
              size={36}
              onPress={onClose}
              testID="code-close"
            >
              <X size={18} color={tokens.textSecondary} strokeWidth={1.8} />
            </IconButton>
          </View>
        </View>
        <ScrollView
          style={styles.viewerBody}
          contentContainerStyle={styles.viewerPad}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.viewerRow}>
            <Text
              style={[
                CODE_TEXT,
                styles.gutter,
                { color: tokens.textTertiary, borderRightColor: tokens.borderSubtle },
              ]}
            >
              {numbers}
            </Text>
            {wrap ? (
              <View style={styles.viewerCodeWrap}>{codeText}</View>
            ) : (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                style={styles.viewerCode}
              >
                {codeText}
              </ScrollView>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Inline ``code`` chip — must stay a Text (paragraph nesting). Carries the
 * fence palette's identifier hue so code reads as code inside prose; short
 * single-word spans get a quiet fill, wrapping spans stay unfilled so the
 * background cannot paint ragged slabs across lines.
 */
export function InlineCode({
  text,
  inheritedStyle,
}: {
  text: string;
  inheritedStyle?: StyleProp<TextStyle>;
}) {
  const { tokens, resolvedMode } = useTheme();
  const colors = useMemo(() => resolveSyntaxColors(tokens, resolvedMode), [tokens, resolvedMode]);
  // Strip the paragraph face/weight/size so Android cannot keep the body
  // font; the paragraph leading stays so the line rhythm is untouched.
  const base = StyleSheet.flatten(inheritedStyle) ?? {};
  const {
    fontFamily: _dropFace,
    fontWeight: _dropWeight,
    fontSize: _dropSize,
    ...lineMetrics
  } = base;
  const chip = text.length <= 24 && !/\s/.test(text);
  return (
    <Text
      selectable
      style={[
        lineMetrics,
        styles.inline,
        chip ? styles.inlineChip : null,
        {
          color: colors.title,
          backgroundColor: chip ? tokens.overlaySubtle : undefined,
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
    borderRadius: radius.card,
    overflow: 'hidden',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    paddingRight: 4,
    minHeight: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  lang: {
    ...typeScale.caption2,
    textTransform: 'lowercase',
    flexShrink: 1,
  },
  codePad: {
    padding: 12,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
  },
  showAll: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: layout.hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showAllLabel: {
    ...typeScale.footnote,
    fontWeight: '500',
  },
  viewer: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    minHeight: 52,
    gap: 8,
  },
  viewerTitle: {
    ...typeScale.headline,
    flexShrink: 1,
  },
  viewerBody: {
    flex: 1,
  },
  viewerPad: {
    paddingVertical: 12,
    paddingRight: 16,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gutter: {
    width: 44,
    paddingRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  viewerCode: {
    flexShrink: 1,
    paddingLeft: 12,
  },
  viewerCodeWrap: {
    flex: 1,
    paddingLeft: 12,
  },
  inline: {
    fontSize: typeScale.callout.fontSize,
  },
  inlineChip: {
    paddingHorizontal: 5,
  },
});
