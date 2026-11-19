import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Search, Users } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { ScreenHeader, TOP_EDGES } from '@/platform/screen-header';
import { useTabBarFootprint } from '@/platform/tab-bar';
import { AgentAvatar } from '@/components/AgentAvatar';
import { ListGroup, ListRow } from '@/components/List';
import { EmptyState, SkeletonList } from '@/components/ListStates';
import { SearchField } from '@/components/SearchField';
import type { AgentSummary } from '@/core/api/types';
import { fetchAgents, useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { layout, useTokens } from '@/theme';
import { filterAgents } from '@/utils/filter-agents';

/**
 * 专家 — the live expert roster as an inset-grouped list: avatar, name,
 * description and runtime state per row, filtered by the search field above
 * it. Each row opens a chat with that expert.
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
  const [query, setQuery] = useState('');

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

  const filtered = useMemo(() => filterAgents(agents, query), [agents, query]);
  const noMatch = loaded && agents.length > 0 && filtered.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]} testID="experts-list">
      <SafeAreaView edges={TOP_EDGES} style={styles.safe}>
        <ScreenHeader
          title={strings.experts.title}
          subtitle={loaded && agents.length > 0 ? strings.experts.count(agents.length) : undefined}
          onMenu={openDrawer}
        />
        <View style={styles.searchWrap}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={strings.experts.searchPlaceholder}
            clearLabel={strings.experts.clearSearch}
            testID="experts-search"
          />
        </View>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, { paddingBottom: tabBarFootprint }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.textTertiary}
              onRefresh={refresh}
            />
          }
        >
          {!loaded ? <SkeletonList /> : null}
          {filtered.length > 0 ? (
            <ListGroup>
              {filtered.map((agent, index) => {
                // A stopped expert is not an error state: it stays in the
                // list and recedes instead of being labelled twice over.
                const muted = agent.state !== 'running';
                return (
                  <ListRow
                    key={agent.agent_id}
                    title={agent.name}
                    subtitle={agent.description ?? undefined}
                    leading={
                      <AgentAvatar
                        name={agent.name}
                        iconName={agent.icon_name}
                        color={agent.color}
                        size={40}
                        fallbackTextSecondary={tokens.textSecondary}
                      />
                    }
                    muted={muted}
                    disclosure
                    last={index === filtered.length - 1}
                    testID={`expert-${agent.agent_id}`}
                    accessibilityHint={agent.description ?? undefined}
                    onPress={() =>
                      router.push({
                        pathname: '/chat/[threadId]',
                        params: { threadId: 'new', agent: agent.agent_id, title: agent.name },
                      })
                    }
                  />
                );
              })}
            </ListGroup>
          ) : null}
          {noMatch ? (
            <EmptyState
              icon={<Search size={26} color={tokens.textTertiary} />}
              title={strings.experts.noResults}
              hint={strings.experts.noResultsHint}
              inline
            />
          ) : null}
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
  searchWrap: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: 10,
  },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 2,
    gap: 12,
  },
});
