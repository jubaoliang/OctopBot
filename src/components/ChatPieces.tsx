import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconArrowRight, IconChevronSmall, IconGlobe } from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { useTokens } from '@/theme';

/** Suggestion pill per design: white surface, radius 8, padding 12/7, arrow 16. */
export function SuggestionPill({ label, onPress }: { label: string; onPress?: () => void }) {
  const t = useTokens();
  return (
    <Pressable style={[styles.pill, { backgroundColor: t.surface }]} onPress={onPress}>
      <Text style={[styles.label, { color: t.textBody }]}>{label}</Text>
      <IconArrowRight width={16} height={16} color={t.textBody} />
    </Pressable>
  );
}

/** User bubble per design: 4% overlay, radius 16/16/4/16, padding 14/8, 15/23 text. */
export function UserBubble({ text }: { text: string }) {
  const t = useTokens();
  return (
    <View style={[styles.bubble, { backgroundColor: t.overlaySubtle }]}>
      <Text style={[styles.bubbleText, { color: t.textBody }]}>{text}</Text>
    </View>
  );
}

/**
 * Process summary card per design: 6% hairline borders, padding 8/0, min
 * height 38 — summary text at 60% with a small chevron.
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
      style={[
        styles.processCard,
        { borderTopColor: t.borderSubtle, borderBottomColor: t.borderSubtle },
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

/** Inline code chip per design: 4% overlay, radius 4, padding 8/2, 13/21 at 60%. */
export function CodeChip({ text }: { text: string }) {
  const t = useTokens();
  return (
    <View style={[styles.codeChip, { backgroundColor: t.overlaySubtle }]}>
      <Text style={[styles.codeText, { color: t.textSecondary }]}>{text}</Text>
    </View>
  );
}

/** Accent link row per design: globe 16 + 16/24 Medium accent text. */
export function LinkRow({ label, onPress }: { label: string; onPress?: () => void }) {
  const t = useTokens();
  return (
    <Pressable style={styles.linkRow} onPress={onPress}>
      <IconGlobe width={16} height={16} color={t.accent} />
      <Text style={[styles.linkText, { color: t.accent }]}>{label}</Text>
    </Pressable>
  );
}

/** Artifact image per design: 240×138, radius 8, in a gap-8 row. */
export function ArtifactImage({ uri }: { uri: string }) {
  return <Image source={{ uri }} style={styles.artifact} />;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  label: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: 260,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  },
  processCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    minHeight: 38,
    alignSelf: 'stretch',
  },
  processText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  codeChip: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  codeText: {
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '400',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  artifact: {
    width: 240,
    height: 138,
    borderRadius: 8,
  },
});
