import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, CloudOff } from 'lucide-react-native';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState, SkeletonList } from '@/components/ListStates';
import type { KnowledgeBase } from '@/core/api/types';
import { KnowledgeApi } from '@/core/api/knowledge';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

/** Knowledge-base list — browse only; opened from the drawer. */
export function KnowledgeListScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const { httpClient, user, ready } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [bases, setBases] = useState<KnowledgeBase[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback((): Promise<void> => {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    return (async () => {
      try {
        const next = await new KnowledgeApi(httpClient).bases();
        if (seq !== requestSeq.current) {
          return;
        }
        setBases(next);
        setFailed(false);
      } catch {
        if (seq !== requestSeq.current) {
          return;
        }
        setFailed(true);
        setBases(prev => prev ?? []);
      } finally {
        if (seq === requestSeq.current) {
          setPending(false);
          setRefreshing(false);
        }
      }
    })();
  }, [httpClient]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    void load();
  }, [ready, user, load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/chat');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]} testID="knowledge-list">
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title={strings.knowledge.title} onBack={goBack} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.accent}
            />
          }
        >
          {pending && bases === null ? (
            <SkeletonList rows={4} />
          ) : failed && (bases === null || bases.length === 0) ? (
            <EmptyState
              icon={<CloudOff size={26} color={tokens.textTertiary} />}
              title={strings.knowledge.errorTitle}
              hint={strings.knowledge.errorHint}
            />
          ) : !bases || bases.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={26} color={tokens.textTertiary} />}
              title={strings.knowledge.emptyTitle}
              hint={strings.knowledge.emptyHint}
            />
          ) : (
            <View
              style={[
                styles.list,
                { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
                pending ? styles.dimmed : null,
              ]}
            >
              {bases.map((base, index) => (
                <Pressable
                  key={base.knowledge_base_id}
                  accessibilityRole="button"
                  accessibilityLabel={base.name}
                  testID={`knowledge-base-${base.knowledge_base_id}`}
                  style={({ pressed }) => [
                    styles.row,
                    index < bases.length - 1
                      ? {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: tokens.borderSubtle,
                        }
                      : null,
                    pressed ? { backgroundColor: tokens.overlayPressed } : null,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: '/knowledge/[kbId]',
                      params: { kbId: base.knowledge_base_id },
                    });
                  }}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.title, { color: tokens.textPrimary }]} numberOfLines={1}>
                      {base.name}
                    </Text>
                    {base.description ? (
                      <Text
                        style={[styles.subtitle, { color: tokens.textSecondary }]}
                        numberOfLines={2}
                      >
                        {base.description}
                      </Text>
                    ) : null}
                  </View>
                  {base.shared ? (
                    <Text style={[styles.badge, { color: tokens.textTertiary }]}>
                      {strings.knowledge.shared}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
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
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    ...continuousCorners,
    overflow: 'hidden',
  },
  dimmed: { opacity: 0.55 },
  row: {
    minHeight: layout.hitTarget,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  title: { ...typeScale.body },
  subtitle: { ...typeScale.footnote },
  badge: { ...typeScale.caption1 },
});
