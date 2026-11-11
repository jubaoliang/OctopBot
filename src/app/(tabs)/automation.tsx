import { RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { AgentAvatar } from '@/components/AgentAvatar';
import { AgentsApi } from '@/core/api/agents';
import { CronApi } from '@/core/api/knowledge';
import type { AgentSummary, CronJob } from '@/core/api/types';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTokens } from '@/theme';

interface AgentCrons {
  agent: AgentSummary;
  jobs: CronJob[];
}

/**
 * 自动化 — the cron roster grouped by expert, with live enable/disable
 * toggles backed by PATCH /api/agents/{id}/cron/{cronId}.
 */
export default function AutomationScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const { httpClient, user, ready } = useAuth();
  const tabBarFootprint = useTabBarFootprint();
  const [sections, setSections] = useState<AgentCrons[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (!ready || !user) {
      return Promise.resolve();
    }
    return (async () => {
      try {
        const agents = await new AgentsApi(httpClient).list();
        const withJobs = await Promise.all(
          agents.map(async agent => ({
            agent,
            jobs: await new CronApi(httpClient).list(agent.agent_id).catch(() => []),
          })),
        );
        // Experts without jobs stay out — no empty dash placeholders.
        setSections(withJobs.filter(s => s.jobs.length > 0));
      } catch {
        // Keep the previous list on refresh failures.
      } finally {
        setLoaded(true);
      }
    })();
  }, [ready, user, httpClient]);

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

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={[styles.safe, { paddingBottom: tabBarFootprint }]}>
        <AppHeader onMenu={openDrawer} />
        <ScrollView
          contentContainerStyle={styles.content}
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
                  style={[styles.sectionTitle, { color: tokens.textPrimary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {agent.name}
                </Text>
              </View>
              {jobs.map(job => (
                <View key={job.id} style={[styles.jobRow, { backgroundColor: tokens.surface }]}>
                  <View style={styles.jobMeta}>
                    <Text style={[styles.jobName, { color: tokens.textBody }]} numberOfLines={1}>
                      {job.name ?? job.prompt.slice(0, 24)}
                    </Text>
                    <Text
                      style={[styles.jobTrigger, { color: tokens.textTertiary }]}
                      numberOfLines={1}
                    >
                      {job.trigger}
                    </Text>
                  </View>
                  <Switch
                    value={job.enabled}
                    onValueChange={next => toggle(agent.agent_id, job, next)}
                    trackColor={{ true: tokens.accent, false: tokens.overlaySubtle }}
                    thumbColor={tokens.surface}
                  />
                </View>
              ))}
            </View>
          ))}
          {loaded && sections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: tokens.textSecondary }]}>
                {strings.automation.emptyTitle}
              </Text>
              <Text style={[styles.emptyHint, { color: tokens.textTertiary }]}>
                {strings.automation.emptyHint}
              </Text>
            </View>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
  },
  jobMeta: {
    flex: 1,
    gap: 2,
  },
  jobName: {
    fontSize: 15,
    lineHeight: 22,
  },
  jobTrigger: {
    fontSize: 13,
    lineHeight: 19,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 96,
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
});
