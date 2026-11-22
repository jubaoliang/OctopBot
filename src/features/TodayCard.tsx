import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';

import { ListGroup, ListRow } from '@/components/List';
import { useTodayDigest } from '@/features/useTodayDigest';
import { useI18n } from '@/i18n/I18nProvider';
import { spacing, useTokens } from '@/theme';

/**
 * At-a-glance proactive teaser on the chat home. The full cross-expert
 * digest lives on the independent Today page (drawer → Today); this card is
 * a single tappable row summarising the most pressing item (latest briefing,
 * else unread, else next routine, else next event) that deep-links into that
 * page. Renders only when there is something to say.
 */
export function TodayCard() {
  const t = useTokens();
  const { t: strings } = useI18n();
  const router = useRouter();
  const { briefings, unread, routines, events } = useTodayDigest();

  const briefing = briefings[0];
  const affair = unread[0];
  const routine = routines[0];
  const event = events[0];
  if (!briefing && !affair && !routine && !event) {
    return null;
  }

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
    <View style={styles.wrap} testID="today-card">
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
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    // Shares the home's 20pt leading edge (12pt scroll padding + 8pt).
    marginHorizontal: 8,
  },
});
