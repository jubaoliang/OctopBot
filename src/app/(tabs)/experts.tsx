import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Users } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { AgentAvatar } from '@/components/AgentAvatar';
import { EmptyState, SkeletonList } from '@/components/ListStates';
import { PressableScale } from '@/components/PressableScale';
import type { AgentSummary } from '@/core/api/types';
import { fetchAgents, useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

/**
 * 专家 — the live expert roster. Each card opens a chat with that expert;
 * the badge reflects the agent's runtime state from the API.
 */
export default function ExpertsScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const { httpClient, user, ready } = useAuth();
  const router = useRouter();
  const tabBarFootprint = useTabBarFootprint();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (!ready || !user) {
      return;
    }
    void fetchAgents(httpClient)
      .then(setAgents)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [ready, user, httpClient]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void fetchAgents(httpClient)
      .then(setAgents)
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader onMenu={openDrawer} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarFootprint }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.textTertiary}
              onRefresh={refresh}
            />
          }
        >
          {!loaded ? <SkeletonList /> : null}
          {agents.map(agent => {
            const running = agent.state === 'running';
            const status = running ? strings.experts.running : strings.experts.idle;
            return (
              <PressableScale
                key={agent.agent_id}
                accessibilityRole="button"
                accessibilityLabel={`${agent.name}, ${status}`}
                accessibilityHint={agent.description ?? undefined}
                scaleTo={0.98}
                style={[styles.card, { backgroundColor: tokens.surface }]}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[threadId]',
                    params: { threadId: 'new', agent: agent.agent_id, title: agent.name },
                  })
                }
              >
                <AgentAvatar
                  name={agent.name}
                  iconName={agent.icon_name}
                  color={agent.color}
                  size={44}
                  fallbackTextSecondary={tokens.textSecondary}
                />
                <View style={styles.meta}>
                  <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
                    {agent.name}
                  </Text>
                  {agent.description ? (
                    <Text style={[styles.desc, { color: tokens.textSecondary }]} numberOfLines={2}>
                      {agent.description}
                    </Text>
                  ) : null}
                  {/* Status is a dot plus a word — never color alone. */}
                  <View style={styles.status}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: running ? tokens.success : tokens.textPlaceholder },
                      ]}
                    />
                    <Text style={[styles.statusText, { color: tokens.textTertiary }]}>
                      {status}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color={tokens.textPlaceholder} />
              </PressableScale>
            );
          })}
          {loaded && agents.length === 0 ? (
            <EmptyState
              icon={<Users size={26} color={tokens.textTertiary} />}
              title={strings.experts.emptyTitle}
              hint={strings.experts.emptyHint}
              action={{ label: strings.experts.retry, onPress: load, testID: 'experts-retry' }}
            />
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
    paddingTop: 8,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.card,
    ...continuousCorners,
    padding: 14,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typeScale.headline,
  },
  desc: {
    ...typeScale.subheadline,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typeScale.caption1,
  },
});
