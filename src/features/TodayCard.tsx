import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarClock, Clock, MessageSquare } from 'lucide-react-native';

import { ListGroup, ListRow } from '@/components/List';
import { useAppShell } from '@/features/app-shell';
import { useCalendarSync } from '@/features/calendar-sync-context';
import { useI18n } from '@/i18n/I18nProvider';
import { calendarReader, type CalendarEvent } from '@/platform/calendar';
import { spacing, useTokens } from '@/theme';
import { countUnreadThreads } from '@/utils/count-unread';
import { formatEventTime, nextEventToday } from '@/utils/today-card';

/**
 * The proactive glance on the chat home: what's next on the schedule, what
 * is waiting to be read, and the way into routines. Renders only when there
 * is something to say — a fresh install keeps the launcher composition.
 * The event row is informational (the device calendar owns the detail);
 * unread and routines rows navigate. The calendar read is local, so it is
 * gated by the OS permission alone — the sync switch governs sending the
 * digest to the server, not showing today's schedule on the device.
 */
export function TodayCard() {
  const t = useTokens();
  const { t: strings, locale } = useI18n();
  const router = useRouter();
  const { drawerGroups, openThread } = useAppShell();
  const { permission, calendars } = useCalendarSync();
  // The fetched list is kept and the next event derived against a `now`
  // captured on focus, so an event that ends while the home stays open
  // stops being "next" on the next focus without an impure render.
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [now, setNow] = useState(0);

  const unreadTotal = countUnreadThreads(drawerGroups);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setNow(Date.now());
      if (permission !== 'granted' || calendars.length === 0) {
        setEvents([]);
        return;
      }
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
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
          // Calendar read failures hide the row, never the card.
          if (!cancelled) {
            setEvents([]);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [permission, calendars]),
  );

  const event = nextEventToday(events, now);
  if (!event && unreadTotal === 0) {
    return null;
  }

  const firstUnread = drawerGroups
    .flatMap(group => group.items.map(item => ({ group, item })))
    .find(({ item }) => item.unreadCount > 0);

  const timeLabel = event ? formatEventTime(event, locale, strings.today.allDay) : null;

  return (
    <View style={styles.wrap} testID="today-card">
      <ListGroup header={strings.today.title}>
        {event ? (
          <ListRow
            title={event.title}
            subtitle={`${strings.today.nextEvent} · ${timeLabel ?? ''}`}
            leading={<CalendarClock size={20} color={t.textSecondary} />}
            testID="today-event"
          />
        ) : null}
        {unreadTotal > 0 && firstUnread ? (
          <ListRow
            title={strings.today.unread(unreadTotal)}
            leading={<MessageSquare size={20} color={t.textSecondary} />}
            onPress={() => openThread(firstUnread.group, firstUnread.item)}
            testID="today-unread"
          />
        ) : null}
        <ListRow
          title={strings.today.routines}
          leading={<Clock size={20} color={t.textSecondary} />}
          disclosure
          onPress={() => router.navigate('/automation')}
          testID="today-routines"
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
