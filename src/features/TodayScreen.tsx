import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarClock, CalendarDays, Clock, MessageSquare, Newspaper } from 'lucide-react-native';

import { ListGroup, ListRow } from '@/components/List';
import { EmptyState } from '@/components/ListStates';
import { ScreenHeader, TOP_EDGES } from '@/platform/screen-header';
import { useAppShell } from '@/features/app-shell';
import { useTodayDigest } from '@/features/useTodayDigest';
import { useI18n } from '@/i18n/I18nProvider';
import { layout, useTokens } from '@/theme';
import { formatEventTime } from '@/utils/today-card';

/**
 * The independent "Today" page (like today.ai's Today pane), opened from the
 * drawer. A cross-expert digest: briefings, unread affairs, upcoming routines
 * and today's schedule — every row attributed to its owning expert and
 * deep-linking into that expert's thread, so the multi-expert backend reads
 * as one proactive surface. Aggregation is app-side (useTodayDigest).
 */
export function TodayScreen() {
  const t = useTokens();
  const { t: strings, locale } = useI18n();
  const router = useRouter();
  const { openThread } = useAppShell();
  const { events, routines, briefings, unread } = useTodayDigest();

  const empty =
    events.length === 0 && routines.length === 0 && briefings.length === 0 && unread.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <SafeAreaView edges={TOP_EDGES} style={styles.safe}>
        <ScreenHeader largeTitle={strings.today.title} onBack={() => router.back()} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {empty ? (
            <EmptyState
              icon={<CalendarDays size={26} color={t.textTertiary} />}
              title={strings.today.emptyTitle}
              hint={strings.today.emptyHint}
            />
          ) : null}

          {briefings.length > 0 ? (
            <ListGroup header={strings.today.briefings}>
              {briefings.map((b, i) => (
                <ListRow
                  key={`${b.agentName}-${b.item.threadId}`}
                  title={`${strings.today.briefing} · ${b.agentName}`}
                  subtitle={b.excerpt}
                  leading={<Newspaper size={20} color={t.textSecondary} />}
                  onPress={() => openThread(b.group, b.item)}
                  testID={`today-page-briefing-${i}`}
                  last={i === briefings.length - 1}
                />
              ))}
            </ListGroup>
          ) : null}

          {unread.length > 0 ? (
            <ListGroup header={strings.today.affairs}>
              {unread.map(({ group, item }, i) => (
                <ListRow
                  key={item.threadId}
                  title={item.title || strings.chat.newThread}
                  subtitle={`${group.name} · ${strings.today.unread(item.unreadCount)}`}
                  leading={<MessageSquare size={20} color={t.textSecondary} />}
                  onPress={() => openThread(group, item)}
                  testID={`today-page-affair-${i}`}
                  last={i === unread.length - 1}
                />
              ))}
            </ListGroup>
          ) : null}

          {routines.length > 0 ? (
            <ListGroup header={strings.today.routinesSection}>
              {routines.map((r, i) => (
                <ListRow
                  key={`${r.agentName}-${r.name}-${r.next_run}`}
                  title={r.name || strings.today.nextRoutine}
                  subtitle={`${r.agentName} · ${
                    r.next_run
                      ? new Date(r.next_run).toLocaleTimeString(locale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''
                  }`}
                  leading={<Clock size={20} color={t.textSecondary} />}
                  disclosure
                  onPress={() => router.navigate('/automation')}
                  testID={`today-page-routine-${i}`}
                  last={i === routines.length - 1}
                />
              ))}
            </ListGroup>
          ) : null}

          {events.length > 0 ? (
            <ListGroup header={strings.today.events}>
              {events.map((event, i) => (
                <ListRow
                  key={`${event.title}-${event.start}`}
                  title={event.title}
                  subtitle={formatEventTime(event, locale, strings.today.allDay)}
                  leading={<CalendarClock size={20} color={t.textSecondary} />}
                  testID={`today-page-event-${i}`}
                  last={i === events.length - 1}
                />
              ))}
            </ListGroup>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 2,
    paddingBottom: 24,
    gap: 24,
  },
});
