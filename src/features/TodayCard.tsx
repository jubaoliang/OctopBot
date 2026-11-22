import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarClock, Clock, MessageSquare, Newspaper } from 'lucide-react-native';

import { ListGroup, ListRow } from '@/components/List';
import { CronApi } from '@/core/api/knowledge';
import { readableText, ThreadsApi } from '@/core/api/threads';
import type { CronJob } from '@/core/api/types';
import { useAppShell } from '@/features/app-shell';
import { fetchAgents, useAuth } from '@/features/auth';
import { useCalendarSync } from '@/features/calendar-sync-context';
import { useI18n } from '@/i18n/I18nProvider';
import { calendarReader, type CalendarEvent } from '@/platform/calendar';
import { spacing, useTokens } from '@/theme';
import { countUnreadThreads } from '@/utils/count-unread';
import { formatEventTime, soonestCron, upcomingToday, type TodayCron } from '@/utils/today-card';

interface BriefingRef {
  agentName: string;
  excerpt: string;
  group: Parameters<ReturnType<typeof useAppShell>['openThread']>[0];
  item: Parameters<ReturnType<typeof useAppShell>['openThread']>[1];
}

const BRIEFING_NAME = /briefing|简报/i;

/**
 * The proactive "Today" glance on the chat home, modelled on a personal
 * assistant's daily digest: the latest briefing (as a tappable card into its
 * thread), today's schedule, the next routine the assistant will run, and
 * unread conversations. Aggregates ACROSS experts app-side — each item is
 * attributed to its owning agent and deep-links to that agent's thread, so
 * the multi-agent backend reads as one proactive surface. Renders only when
 * there is something to say. All reads use existing APIs; no backend change.
 */
export function TodayCard() {
  const t = useTokens();
  const { t: strings, locale } = useI18n();
  const router = useRouter();
  const { httpClient } = useAuth();
  const { drawerGroups, openThread } = useAppShell();
  const { permission, calendars } = useCalendarSync();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [now, setNow] = useState(0);
  const [nextRoutine, setNextRoutine] = useState<TodayCron | null>(null);
  const [briefing, setBriefing] = useState<BriefingRef | null>(null);

  const unreadTotal = countUnreadThreads(drawerGroups);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const at = Date.now();
      setNow(at);

      if (permission === 'granted' && calendars.length > 0) {
        const start = new Date(at);
        start.setHours(0, 0, 0, 0);
        const end = new Date(at);
        end.setHours(23, 59, 59, 999);
        void calendarReader
          .listEvents(
            calendars.map(c => c.id),
            start,
            end,
          )
          .then(list => {
            if (!cancelled) {
              setEvents(list);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setEvents([]);
            }
          });
      } else {
        setEvents([]);
      }

      // Aggregate routines across experts; the briefing owner is the expert
      // that owns a briefing-named routine (else none).
      void (async () => {
        try {
          const agents = await fetchAgents(httpClient);
          const perAgent = await Promise.all(
            agents.map(async agent => ({
              agent,
              jobs: await new CronApi(httpClient).list(agent.agent_id).catch(() => [] as CronJob[]),
            })),
          );
          if (cancelled) {
            return;
          }
          const jobs: TodayCron[] = perAgent.flatMap(({ agent, jobs }) =>
            jobs.map(j => ({ ...j, agentName: agent.name })),
          );
          setNextRoutine(soonestCron(jobs, at));

          const owner = perAgent.find(({ jobs }) =>
            jobs.some(j => BRIEFING_NAME.test(j.name ?? '')),
          );
          if (!owner) {
            setBriefing(null);
            return;
          }
          const group = drawerGroups.find(g => g.agentId === owner.agent.agent_id);
          const item = group?.items[0];
          if (!group || !item) {
            setBriefing(null);
            return;
          }
          const page = await new ThreadsApi(httpClient).history(
            owner.agent.agent_id,
            item.threadId,
            {
              limit: 8,
            },
          );
          if (cancelled) {
            return;
          }
          const lastAssistant = [...page.messages].reverse().find(m => m.role === 'assistant');
          const text = lastAssistant ? readableText(lastAssistant.content) : '';
          setBriefing(text ? { agentName: owner.agent.name, excerpt: text, group, item } : null);
        } catch {
          if (!cancelled) {
            setNextRoutine(null);
            setBriefing(null);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [permission, calendars, httpClient, drawerGroups]),
  );

  const upcoming = upcomingToday(events, now, 3);
  if (!briefing && upcoming.length === 0 && !nextRoutine && unreadTotal === 0) {
    return null;
  }

  const firstUnread = drawerGroups
    .flatMap(group => group.items.map(item => ({ group, item })))
    .find(({ item }) => item.unreadCount > 0);

  const routineTime = nextRoutine?.next_run
    ? new Date(nextRoutine.next_run).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <View style={styles.wrap} testID="today-card">
      <ListGroup header={strings.today.title}>
        {briefing ? (
          <ListRow
            title={`${strings.today.briefing} · ${briefing.agentName}`}
            subtitle={briefing.excerpt}
            leading={<Newspaper size={20} color={t.textSecondary} />}
            onPress={() => openThread(briefing.group, briefing.item)}
            testID="today-briefing"
          />
        ) : null}
        {upcoming.map((event, i) => (
          <ListRow
            key={`${event.title}-${event.start}`}
            title={event.title}
            subtitle={formatEventTime(event, locale, strings.today.allDay)}
            leading={<CalendarClock size={20} color={t.textSecondary} />}
            testID={`today-event-${i}`}
          />
        ))}
        {nextRoutine ? (
          <ListRow
            title={nextRoutine.name || strings.today.nextRoutine}
            subtitle={`${nextRoutine.agentName ?? ''} · ${routineTime ?? ''}`}
            leading={<Clock size={20} color={t.textSecondary} />}
            disclosure
            onPress={() => router.navigate('/automation')}
            testID="today-next-routine"
          />
        ) : null}
        {unreadTotal > 0 && firstUnread ? (
          <ListRow
            title={strings.today.unread(unreadTotal)}
            leading={<MessageSquare size={20} color={t.textSecondary} />}
            onPress={() => openThread(firstUnread.group, firstUnread.item)}
            testID="today-unread"
            last
          />
        ) : null}
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
