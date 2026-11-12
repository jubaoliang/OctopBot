import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { IconArrowRight, IconChevronSmall, IconGlobe } from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { CODE_FONT } from '@/theme/code-font';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

/** Suggestion pill per design: white surface, radius 8, trailing arrow — 44pt tall. */
export function SuggestionPill({ label, onPress }: { label: string; onPress?: () => void }) {
  const t = useTokens();
  return (
    <PressableScale
      accessibilityRole="button"
      style={[styles.pill, { backgroundColor: t.surface, shadowColor: t.shadowSoft }]}
      onPress={onPress}
    >
      <Text style={[styles.label, { color: t.textBody }]}>{label}</Text>
      <IconArrowRight width={16} height={16} color={t.textBody} />
    </PressableScale>
  );
}

/** User bubble per design: 4% overlay, tailed corner, body text; long-press to copy. */
export function UserBubble({ text }: { text: string }) {
  const t = useTokens();
  return (
    <View style={[styles.bubble, { backgroundColor: t.overlaySubtle }]}>
      <Text selectable style={[styles.bubbleText, { color: t.textBody }]}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Process summary card per design: 6% hairline borders — summary text at
 * 60% with a small chevron, one full touch target tall.
 */
export function ProcessCard({
  tools,
  thinking,
  onPress,
}: {
  tools: number;
  thinking: number;
  onPress?: () => void;
}) {
  const t = useTokens();
  const { t: strings } = useI18n();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.processCard,
        { borderTopColor: t.borderSubtle, borderBottomColor: t.borderSubtle },
        pressed ? { backgroundColor: t.overlaySubtle } : null,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.processText, { color: t.textSecondary }]}>
        {strings.chat.processSummary(tools, thinking)}
      </Text>
      <IconChevronSmall width={16} height={16} color={t.textSecondary} />
    </Pressable>
  );
}

/** Inline code chip per design: readable fill, radius 4, monospace footnote. */
export function CodeChip({ text }: { text: string }) {
  const t = useTokens();
  return (
    <View style={[styles.codeChip, { backgroundColor: t.overlayPressed }]}>
      <Text style={[styles.codeText, { color: t.textSecondary, fontFamily: CODE_FONT }]}>
        {text}
      </Text>
    </View>
  );
}

/** Accent link row per design: globe 16 + headline-weight accent text. */
export function LinkRow({ label, onPress }: { label: string; onPress?: () => void }) {
  const t = useTokens();
  return (
    <PressableScale
      accessibilityRole="link"
      dimTo={0.6}
      scaleTo={1}
      style={styles.linkRow}
      onPress={onPress}
    >
      <IconGlobe width={16} height={16} color={t.accent} />
      <Text style={[styles.linkText, { color: t.accent }]}>{label}</Text>
    </PressableScale>
  );
}

/** Artifact image per design: 240×138, radius 8, in a gap-8 row. */
export function ArtifactImage({ uri }: { uri: string }) {
  return <Image source={{ uri }} accessibilityIgnoresInvertColors style={styles.artifact} />;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: layout.hitTarget,
    borderRadius: radius.pill,
    ...continuousCorners,
    paddingHorizontal: 14,
    paddingVertical: 10,
    // Design: drop shadow y 4, radius 20, black 3%.
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 1,
  },
  label: {
    ...typeScale.subheadline,
    flexShrink: 1,
  },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    borderTopLeftRadius: radius.bubble,
    borderTopRightRadius: radius.bubble,
    borderBottomRightRadius: radius.bubbleTail,
    borderBottomLeftRadius: radius.bubble,
    ...continuousCorners,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleText: {
    ...typeScale.reading,
  },
  processCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    minHeight: layout.hitTarget,
    alignSelf: 'stretch',
  },
  processText: {
    ...typeScale.subheadline,
  },
  codeChip: {
    borderRadius: radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  codeText: {
    ...typeScale.footnote,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: layout.hitTarget,
    alignSelf: 'flex-start',
  },
  linkText: {
    ...typeScale.headline,
  },
  artifact: {
    width: 240,
    height: 138,
    borderRadius: radius.pill,
  },
});
