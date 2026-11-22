import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { CronApi } from '@/core/api/knowledge';
import { readableText, ThreadsApi } from '@/core/api/threads';
import type { CronJob } from '@/core/api/types';
import { useAppShell } from '@/features/app-shell';
import { fetchAgents, useAuth } from '@/features/auth';
import { useCalendarSync } from '@/features/calendar-sync-context';
import { calendarReader, type CalendarEvent } from '@/platform/calendar';
import type { DrawerTaskGroup, DrawerThread } from '@/components/AppDrawer';
import { upcomingToday, type TodayCron } from '@/utils/today-card';

export interface DigestBriefing {
  agentName: string;
  excerpt: string;
  group: DrawerTaskGroup;
  item: DrawerThread;
}

export interface DigestRoutine extends TodayCron {
  agentName: string;
}

export interface DigestUnread {
  group: DrawerTaskGroup;
  item: DrawerThread;
}

const BRIEFING_NAME = /briefing|简报/i;

/**
 * Shared cross-expert "Today" aggregation (app-side; Octop untouched).
 * Reads the device calendar, every expert's routines, and each briefing
 * owner's latest thread, plus unread threads across all experts. Each item
 * keeps its owning agent so the UI can attribute and deep-link — the
 * multi-expert adaptation of a single-agent daily digest.
 */
export function useTodayDigest() {
  const { httpClient } = useAuth();
  const { drawerGroups } = useAppShell();
  const { permission, calendars } = useCalendarSync();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [now, setNow] = useState(0);
  const [routines, setRoutines] = useState<DigestRoutine[]>([]);
  const [briefings, setBriefings] = useState<DigestBriefing[]>([]);

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
          const all: DigestRoutine[] = perAgent.flatMap(({ agent, jobs }) =>
            jobs
              .filter(j => j.enabled && j.next_run && Date.parse(j.next_run) > at)
              .map(j => ({ ...j, agentName: agent.name })),
          );
          all.sort((a, b) => Date.parse(a.next_run ?? '') - Date.parse(b.next_run ?? ''));
          setRoutines(all);

          const owners = perAgent.filter(({ jobs }) =>
            jobs.some(j => BRIEFING_NAME.test(j.name ?? '')),
          );
          const found: DigestBriefing[] = [];
          for (const { agent } of owners) {
            const group = drawerGroups.find(g => g.agentId === agent.agent_id);
            const item = group?.items[0];
            if (!group || !item) {
              continue;
            }
            const page = await new ThreadsApi(httpClient).history(agent.agent_id, item.threadId, {
              limit: 8,
            });
            if (cancelled) {
              return;
            }
            const lastAssistant = [...page.messages].reverse().find(m => m.role === 'assistant');
            const text = lastAssistant ? readableText(lastAssistant.content) : '';
            if (text) {
              found.push({ agentName: agent.name, excerpt: text, group, item });
            }
          }
          if (!cancelled) {
            setBriefings(found);
          }
        } catch {
          if (!cancelled) {
            setRoutines([]);
            setBriefings([]);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [permission, calendars, httpClient, drawerGroups]),
  );

  const unread: DigestUnread[] = drawerGroups.flatMap(group =>
    group.items.filter(item => item.unreadCount > 0).map(item => ({ group, item })),
  );

  return { events: upcomingToday(events, now, 6), now, routines, briefings, unread };
}
