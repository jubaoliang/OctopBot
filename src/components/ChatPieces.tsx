import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { Terminal } from 'lucide-react-native';

import { PressableScale } from '@/components/PressableScale';
import { IconArrowRight, IconChevronSmall, IconGlobe } from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { RemoteImage } from '@/platform/remote-image';
import { CODE_FONT } from '@/theme/code-font';
import { continuousCorners, layout, motion, radius, typeScale, useTokens } from '@/theme';
import type { ProcessStep } from '@/core/chat/process-steps';

/** One thumbnail rendered inside a user bubble (local URI or auth-gated URL). */
export interface BubbleImage {
  uri: string;
  headers?: Record<string, string>;
  label: string;
}

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
export function UserBubble({
  text,
  images,
  attachmentNames,
}: {
  text: string;
  /** Inline image thumbnails (preferred over filename-only chips). */
  images?: BubbleImage[];
  /** Non-image filenames (or image fallback when no resolvable URI). */
  attachmentNames?: string[];
}) {
  const t = useTokens();
  const hasImages = images !== undefined && images.length > 0;
  return (
    <View style={[styles.bubble, { backgroundColor: t.overlaySubtle }]}>
      {hasImages ? (
        <View style={styles.bubbleImages} testID="chat-bubble-images">
          {images.map((image, index) => (
            <RemoteImage
              key={`${image.uri}-${index}`}
              uri={image.uri}
              headers={image.headers}
              accessibilityLabel={image.label}
              testID={`chat-bubble-image-${index}`}
              style={styles.bubbleThumb}
              contentFit="cover"
            />
          ))}
        </View>
      ) : null}
      {attachmentNames?.map((name, index) => (
        <Text
          key={`${name}-${index}`}
          numberOfLines={1}
          ellipsizeMode="middle"
          style={[styles.bubbleAttachment, { color: t.textSecondary }]}
        >
          {name}
        </Text>
      ))}
      {text ? (
        <Text selectable style={[styles.bubbleText, { color: t.textBody }]}>
          {text}
        </Text>
      ) : null}
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
  steps,
  onToggle,
}: {
  tools: number;
  thinking: number;
  /** Reasoning and tool calls of the current turn; the card expands to them. */
  steps?: ProcessStep[];
  /** Reports the new state so the transcript can keep the body in view. */
  onToggle?: (expanded: boolean) => void;
}) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const [open, setOpen] = useState(false);
  const trace = steps ?? [];
  // No trace (history without reasoning, or a turn that only produced text):
  // the row stays a plain summary and shows no affordance it cannot honour.
  const expandable = trace.length > 0;
  const expanded = expandable && open;

  return (
    <View
      style={[
        styles.processBlock,
        { borderTopColor: t.borderSubtle, borderBottomColor: t.borderSubtle },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.chat.processSummary(tools, thinking)}
        accessibilityState={{ expanded, disabled: !expandable }}
        testID="process-toggle"
        disabled={!expandable}
        style={({ pressed }) => [
          styles.processCard,
          pressed && expandable ? { backgroundColor: t.overlaySubtle } : null,
        ]}
        onPress={() => {
          const next = !open;
          setOpen(next);
          onToggle?.(next);
        }}
      >
        <Text style={[styles.processText, { color: t.textSecondary }]}>
          {strings.chat.processSummary(tools, thinking)}
        </Text>
        {expandable ? (
          <Animated.View
            style={[chevronFlip, { transform: [{ rotate: expanded ? '90deg' : '0deg' }] }]}
          >
            <IconChevronSmall width={16} height={16} color={t.textSecondary} />
          </Animated.View>
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={styles.processBody} testID="process-detail">
          {trace.map((step, index) =>
            step.kind === 'thinking' ? (
              <View
                key={`t-${index}`}
                style={[styles.thinkingBlock, { borderLeftColor: t.borderStrong }]}
              >
                <Text selectable style={[styles.thinkingText, { color: t.textSecondary }]}>
                  {step.text}
                </Text>
              </View>
            ) : (
              <View key={`c-${index}`} style={styles.toolRow}>
                <Terminal size={14} color={t.textTertiary} strokeWidth={2.2} />
                <Text style={[styles.toolName, { color: t.textBody }]} numberOfLines={2}>
                  {step.name}
                </Text>
              </View>
            ),
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Chevron that turns with the expand state (UI-thread CSS transition). */
const chevronFlip = {
  transitionProperty: 'transform',
  transitionDuration: motion.state,
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const;

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
export function ArtifactImage({ uri, headers }: { uri: string; headers?: Record<string, string> }) {
  return <RemoteImage uri={uri} headers={headers} style={styles.artifact} contentFit="cover" />;
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
  bubbleImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  bubbleThumb: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    ...continuousCorners,
  },
  bubbleAttachment: {
    ...typeScale.footnote,
    marginBottom: 2,
  },
  processBlock: {
    alignSelf: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  processCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    minHeight: layout.hitTarget,
  },
  processBody: {
    gap: 10,
    paddingBottom: 12,
  },
  thinkingBlock: {
    borderLeftWidth: 2,
    paddingLeft: 10,
  },
  thinkingText: {
    ...typeScale.subheadline,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  toolName: {
    ...typeScale.subheadline,
    flexShrink: 1,
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
