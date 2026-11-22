import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ListGroup, ListRow } from '@/components/List';
import { useTodayDigest } from '@/features/useTodayDigest';
import { useI18n } from '@/i18n/I18nProvider';
import { motion, useTokens } from '@/theme';

// Reserved reveal height: wrap margin (24) + group header (~20) + one row (~64).
const SLOT_HEIGHT = 108;

/**
 * At-a-glance proactive teaser on the chat home. The full cross-expert
 * digest lives on the independent Today page (drawer → Today); this card is
 * a single tappable row summarising the most pressing item (latest briefing,
 * else unread, else next routine, else next event) that deep-links into that
 * page.
 *
 * The digest loads asynchronously, so the card appears after first paint.
 * Mounting it outright reflowed the home's centred layout and read as a
 * bounce; instead the slot's height/opacity animate open (and closed), so
 * the reveal is a smooth expand with no layout jump and no permanent gap.
 */
export function TodayCard() {
  const t = useTokens();
  const { t: strings } = useI18n();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { briefings, unread, routines, events } = useTodayDigest();

  const briefing = briefings[0];
  const affair = unread[0];
  const routine = routines[0];
  const event = events[0];
  const hasData = Boolean(briefing || affair || routine || event);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(hasData ? 1 : 0, {
      duration: reduceMotion ? 0 : motion.state,
    });
  }, [hasData, reduceMotion, progress]);

  const slotStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, SLOT_HEIGHT]),
    opacity: progress.value,
  }));

  const title = briefing
    ? `${strings.today.briefing} · ${briefing.agentName}`
    : affair
      ? strings.today.unread(unread.length)
      : routine
        ? routine.name || strings.today.nextRoutine
        : (event?.title ?? strings.today.title);
  const subtitle = briefing
    ? briefing.excerpt
    : affair
      ? affair.group.name
      : routine
        ? routine.agentName
        : strings.today.events;

  return (
    <Animated.View
      style={[styles.slot, slotStyle]}
      testID="today-card"
      pointerEvents={hasData ? 'auto' : 'none'}
    >
      <View style={styles.inner}>
        <ListGroup header={strings.today.title}>
          <ListRow
            title={title}
            subtitle={subtitle}
            leading={<CalendarDays size={20} color={t.textSecondary} />}
            disclosure
            onPress={() => router.push('/today')}
            testID="today-teaser"
            last
          />
        </ListGroup>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    // Shares the home's 20pt leading edge (12pt scroll padding + 8pt).
    marginHorizontal: 8,
  },
  inner: {
    height: SLOT_HEIGHT,
    paddingTop: 24,
  },
});
