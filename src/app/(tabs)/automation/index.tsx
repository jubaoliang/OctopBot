import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';

import { ScreenHeader, TOP_EDGES } from '@/platform/screen-header';
import { useTabBarFootprint } from '@/platform/tab-bar';
import { ActionSheet } from '@/platform/action-sheet';
import { AgentAvatar } from '@/components/AgentAvatar';
import { ListGroup, ListRow } from '@/components/List';
import { EmptyState, SkeletonList } from '@/components/ListStates';
import { AgentsApi } from '@/core/api/agents';
import { CronApi } from '@/core/api/knowledge';
import type { AgentSummary, CronJob } from '@/core/api/types';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { putChatHandoff } from '@/features/chat-handoff';
import { RoutineBuilderSheet } from '@/features/RoutineBuilderSheet';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';
import { resolveTaskExamples } from '@/utils/quick-prompts';

interface AgentCrons {
  agent: AgentSummary;
  jobs: CronJob[];
  examples: string[];
}

/**
 * 自动化 — the cron roster grouped by expert, with live enable/disable
 * toggles, run-now/delete on long-press, a routine builder behind the
 * header's +, and the server's per-expert routine suggestions for experts
 * that have no jobs yet (a tap drafts the schedule in a chat — natural
 * language routines are created conversationally, not parsed here).
 */
export default function AutomationScreen() {
  const tokens = useTokens();
  const { t: strings, locale } = useI18n();
  const { openDrawer } = useAppShell();
  const { httpClient, user, ready } = useAuth();
  const router = useRouter();
  const tabBarFootprint = useTabBarFootprint();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [sections, setSections] = useState<AgentCrons[]>([]);
  const [suggestions, setSuggestions] = useState<AgentCrons[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [jobActions, setJobActions] = useState<{ agent: AgentSummary; job: CronJob } | null>(null);
  // Last run-now outcome, sticky until fresh data supersedes it — a timed
  // flash would be invisible to slow assistive tech (and slow automation).
  const [runNowFlash, setRunNowFlash] = useState<{ id: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    if (!ready || !user) {
      return Promise.resolve();
    }
    return (async () => {
      try {
        const agentsApi = new AgentsApi(httpClient);
        const cronApi = new CronApi(httpClient);
        const roster = await agentsApi.list();
        const withJobs = await Promise.all(
          roster.map(async agent => {
            const jobs = await cronApi.list(agent.agent_id).catch(() => [] as CronJob[]);
            // Suggestions only matter for experts without jobs — skip the
            // welcome round-trip for everyone else.
            const examples =
              jobs.length === 0
                ? resolveTaskExamples(
                    (await agentsApi.welcome(agent.agent_id).catch(() => null))?.task_examples ??
                      null,
                    locale,
                  )
                : [];
            return { agent, jobs, examples };
          }),
        );
        setAgents(roster);
        // Fresh server data supersedes any sticky run-now status.
        setRunNowFlash(null);
        // Experts without jobs stay out of the roster — no empty dash
        // placeholders; their suggestions get their own section below.
        setSections(withJobs.filter(s => s.jobs.length > 0));
        setSuggestions(withJobs.filter(s => s.jobs.length === 0 && s.examples.length > 0));
      } catch {
        // Keep the previous list on refresh failures.
      } finally {
        setLoaded(true);
      }
    })();
  }, [ready, user, httpClient, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (agentId: string, job: CronJob, next: boolean) => {
    // Optimistic flip; revert on failure.
    setSections(prev =>
      prev.map(s =>
        s.agent.agent_id === agentId
          ? { ...s, jobs: s.jobs.map(j => (j.id === job.id ? { ...j, enabled: next } : j)) }
          : s,
      ),
    );
    void new CronApi(httpClient).update(agentId, job.id, { enabled: next }).catch(() => {
      setSections(prev =>
        prev.map(s =>
          s.agent.agent_id === agentId
            ? {
                ...s,
                jobs: s.jobs.map(j => (j.id === job.id ? { ...j, enabled: !next } : j)),
              }
            : s,
        ),
      );
    });
  };

  // Visible row status for run-now outcomes — haptics are never the only
  // feedback. Sticky until the roster reloads with fresh server data.
  const runNow = (agentId: string, job: CronJob) => {
    void new CronApi(httpClient)
      .runNow(agentId, job.id)
      .then(() => {
        haptics.impact();
        setRunNowFlash({ id: job.id, ok: true });
      })
      .catch(() => {
        haptics.notify('error');
        setRunNowFlash({ id: job.id, ok: false });
      });
  };

  const removeJob = (agentId: string, job: CronJob) => {
    const updated = sections.map(s =>
      s.agent.agent_id === agentId ? { ...s, jobs: s.jobs.filter(j => j.id !== job.id) } : s,
    );
    // An expert whose last job is deleted leaves the roster; if it still
    // has server suggestions, it resurfaces under "Suggested routines".
    const emptied = updated.filter(s => s.jobs.length === 0 && s.examples.length > 0);
    setSections(updated.filter(s => s.jobs.length > 0));
    if (emptied.length > 0) {
      setSuggestions(prev => [
        ...prev,
        ...emptied.filter(s => !prev.some(p => p.agent.agent_id === s.agent.agent_id)),
      ]);
    }
    void new CronApi(httpClient)
      .remove(agentId, job.id)
      .then(() => haptics.impact())
      .catch(() => {
        // Restore the truth on failure.
        void load();
      });
  };

  const confirmRemoveJob = (agentId: string, job: CronJob) => {
    Alert.alert(strings.automation.deleteTitle, strings.automation.deleteBody, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: strings.automation.delete,
        style: 'destructive',
        onPress: () => removeJob(agentId, job),
      },
    ]);
  };

  // Suggested routines are natural-language schedules ("Every day at 09:00,
  // …") — the expert creates the cron conversationally, so a tap drafts the
  // sentence in a new chat instead of parsing it client-side.
  const draftRoutine = (agent: AgentSummary, text: string) => {
    const handoff = putChatHandoff(text, [], 'draft');
    router.push({
      pathname: '/chat/[threadId]',
      params: { threadId: 'new', agent: agent.agent_id, title: agent.name, handoff },
    });
  };

  const jobTitle = (job: CronJob): string =>
    job.name && job.name.trim().length > 0 ? job.name : job.prompt.slice(0, 40);

  const nextRunLabel = (job: CronJob): string => {
    if (runNowFlash?.id === job.id) {
      return runNowFlash.ok ? strings.automation.runNowStarted : strings.automation.runNowFailed;
    }
    if (!job.next_run) {
      return job.trigger;
    }
    const when = new Date(job.next_run).toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return strings.automation.nextRun(when);
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={TOP_EDGES} style={styles.safe}>
        <ScreenHeader
          title={strings.automation.title}
          onMenu={openDrawer}
          onCompose={() => setBuilderOpen(true)}
          composeLabel={strings.automation.newRoutine}
        />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, { paddingBottom: tabBarFootprint }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.textTertiary}
              onRefresh={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
            />
          }
        >
          {!loaded ? <SkeletonList rows={3} /> : null}
          {sections.map(({ agent, jobs }) => (
            <View key={agent.agent_id} style={styles.section}>
              <View style={styles.sectionHead}>
                <AgentAvatar
                  name={agent.name}
                  iconName={agent.icon_name}
                  color={agent.color}
                  size={20}
                  fallbackTextSecondary={tokens.textSecondary}
                />
                <Text
                  accessibilityRole="header"
                  style={[styles.sectionTitle, { color: tokens.textPrimary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {agent.name}
                </Text>
              </View>
              <View
                style={[
                  styles.group,
                  { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
                ]}
              >
                {jobs.map((job, index) => {
                  const name =
                    job.name && job.name.trim().length > 0 ? job.name : job.prompt.slice(0, 24);
                  return (
                    <View
                      key={job.id}
                      testID={`automation-job-${job.id}`}
                      style={[
                        styles.jobRow,
                        { borderBottomColor: tokens.separator },
                        index === jobs.length - 1 ? styles.jobRowLast : null,
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityHint={strings.automation.jobActionsHint}
                        style={styles.jobMeta}
                        onPress={() => setJobActions({ agent, job })}
                        onLongPress={() => {
                          haptics.impact('medium');
                          setJobActions({ agent, job });
                        }}
                      >
                        <Text
                          style={[styles.jobName, { color: tokens.textBody }]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        <Text
                          style={[styles.jobTrigger, { color: tokens.textTertiary }]}
                          numberOfLines={1}
                        >
                          {nextRunLabel(job)}
                        </Text>
                      </Pressable>
                      <Switch
                        accessibilityLabel={name}
                        value={job.enabled}
                        onValueChange={next => {
                          haptics.selection();
                          toggle(agent.agent_id, job, next);
                        }}
                        trackColor={{ true: tokens.accent, false: tokens.fill }}
                        thumbColor={tokens.surfaceRaised}
                        ios_backgroundColor={tokens.fill}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
          {loaded && suggestions.length > 0 ? (
            <View style={styles.section} testID="automation-suggested">
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, { color: tokens.textPrimary }]}
              >
                {strings.automation.suggestedTitle}
              </Text>
              <ListGroup footer={strings.automation.suggestedHint}>
                {suggestions
                  .flatMap(({ agent, examples }) =>
                    examples.map((text, exampleIndex) => ({ agent, text, exampleIndex })),
                  )
                  .map(({ agent, text, exampleIndex }, rowIndex, rows) => (
                    <ListRow
                      key={`${agent.agent_id}-${exampleIndex}`}
                      title={agent.name}
                      subtitle={text}
                      leading={
                        <AgentAvatar
                          name={agent.name}
                          iconName={agent.icon_name}
                          color={agent.color}
                          size={20}
                          fallbackTextSecondary={tokens.textSecondary}
                        />
                      }
                      onPress={() => draftRoutine(agent, text)}
                      testID={`automation-suggestion-${agent.agent_id}-${exampleIndex}`}
                      last={rowIndex === rows.length - 1}
                    />
                  ))}
              </ListGroup>
            </View>
          ) : null}
          {loaded && sections.length === 0 && suggestions.length === 0 ? (
            <EmptyState
              icon={<CalendarClock size={26} color={tokens.textTertiary} />}
              title={strings.automation.emptyTitle}
              hint={strings.automation.emptyHint}
              action={{
                label: strings.automation.retry,
                onPress: () => {
                  void load();
                },
                testID: 'automation-retry',
              }}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <RoutineBuilderSheet
        visible={builderOpen}
        onClose={() => setBuilderOpen(false)}
        agents={agents}
        onCreated={() => {
          void load();
        }}
      />

      <ActionSheet
        visible={jobActions !== null}
        title={jobActions ? jobTitle(jobActions.job) : ''}
        items={[
          {
            label: strings.automation.runNow,
            onPress: () => {
              if (jobActions) {
                runNow(jobActions.agent.agent_id, jobActions.job);
              }
            },
          },
          {
            label: strings.automation.delete,
            destructive: true,
            onPress: () => {
              if (jobActions) {
                confirmRemoveJob(jobActions.agent.agent_id, jobActions.job);
              }
            },
          },
        ]}
        cancelLabel={strings.common.cancel}
        dismissLabel={strings.a11y.closeSheet}
        onClose={() => setJobActions(null)}
        testID="routine-actions"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 2,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...typeScale.subheadline,
    fontWeight: '600',
    flexShrink: 1,
  },
  group: {
    borderRadius: radius.card,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingLeft: layout.screenMargin,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingRight: layout.screenMargin,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  jobRowLast: {
    borderBottomWidth: 0,
  },
  jobMeta: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 44,
  },
  jobName: {
    ...typeScale.body,
  },
  jobTrigger: {
    ...typeScale.footnote,
  },
});
