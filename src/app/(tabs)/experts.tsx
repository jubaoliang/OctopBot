import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { IconArrowRight } from '@/components/icons';
import type { AgentSummary } from '@/core/api/types';
import { fetchAgents, useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useTokens } from '@/theme';

/**
 * 专家 — the live expert roster. Each card opens a chat with that expert;
 * the badge reflects the agent's runtime state from the API.
 */
export default function ExpertsScreen() {
  const tokens = useTokens();
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
      <View style={[styles.safe, { paddingBottom: tabBarFootprint }]}>
        <AppHeader onMenu={openDrawer} />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.textTertiary}
              onRefresh={refresh}
            />
          }
        >
          {agents.map(agent => (
            <Pressable
              key={agent.agent_id}
              accessibilityRole="button"
              accessibilityLabel={agent.name}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: tokens.surface, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() =>
                router.push({
                  pathname: '/chat/[threadId]',
                  params: { threadId: 'new', agent: agent.agent_id, title: agent.name },
                })
              }
            >
              <View style={[styles.avatar, { backgroundColor: tokens.overlaySubtle }]}>
                <Text style={[styles.avatarText, { color: tokens.textSecondary }]}>
                  {agent.name.slice(0, 1)}
                </Text>
              </View>
              <View style={styles.meta}>
                <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
                  {agent.name}
                </Text>
                {agent.description ? (
                  <Text style={[styles.desc, { color: tokens.textSecondary }]} numberOfLines={1}>
                    {agent.description}
                  </Text>
                ) : null}
              </View>
              <View style={styles.tail}>
                <View style={[styles.badge, { backgroundColor: tokens.overlaySubtle }]}>
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: agent.state === 'running' ? tokens.textBody : tokens.textTertiary,
                      },
                    ]}
                  >
                    {agent.state === 'running' ? '●' : '○'}
                  </Text>
                </View>
                <IconArrowRight width={16} height={16} color={tokens.textTertiary} />
              </View>
            </Pressable>
          ))}
          {loaded && agents.length === 0 ? (
            <Text style={[styles.empty, { color: tokens.textTertiary }]}>—</Text>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingTop: 47 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  desc: {
    fontSize: 13,
    lineHeight: 19,
  },
  tail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
  },
  empty: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
  },
});
