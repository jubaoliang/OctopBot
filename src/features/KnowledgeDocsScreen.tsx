import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, CloudOff, FileText, Folder } from 'lucide-react-native';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState, SkeletonList } from '@/components/ListStates';
import type { KnowledgeDocument } from '@/core/api/types';
import { KnowledgeApi } from '@/core/api/knowledge';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';
import {
  isKnowledgeFolder,
  knowledgeChildPrefix,
  knowledgeDocumentId,
  knowledgeDocumentLabel,
} from '@/utils/knowledge-tree';
import { firstRouteParam } from '@/utils/route-params';

interface DocsPage {
  key: string;
  docs: KnowledgeDocument[];
  failed: boolean;
}

/** Documents under a knowledge base (or folder prefix). */
export function KnowledgeDocsScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const { httpClient, user, ready } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kbId?: string | string[]; prefix?: string | string[] }>();
  const kbId = firstRouteParam(params.kbId);
  const prefix = firstRouteParam(params.prefix);
  const pageKey = `${kbId}\0${prefix}`;

  const [page, setPage] = useState<DocsPage | null>(null);
  const [pending, setPending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback((): Promise<void> => {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    const key = `${kbId}\0${prefix}`;
    return (async () => {
      if (!kbId) {
        if (seq === requestSeq.current) {
          setPage({ key, docs: [], failed: true });
          setPending(false);
          setRefreshing(false);
        }
        return;
      }
      try {
        const next = await new KnowledgeApi(httpClient).documents(kbId, prefix);
        if (seq !== requestSeq.current) {
          return;
        }
        setPage({ key, docs: next, failed: false });
      } catch {
        if (seq !== requestSeq.current) {
          return;
        }
        setPage(prev => {
          if (prev?.key === key && prev.docs.length > 0) {
            return { ...prev, failed: true };
          }
          return { key, docs: [], failed: true };
        });
      } finally {
        if (seq === requestSeq.current) {
          setPending(false);
          setRefreshing(false);
        }
      }
    })();
  }, [httpClient, kbId, prefix]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    void load();
  }, [ready, user, kbId, prefix, load]);

  const current = page?.key === pageKey ? page : null;

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const retry = () => {
    setPending(true);
    void load();
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/knowledge');
    }
  };

  const openDoc = (doc: KnowledgeDocument) => {
    haptics.selection();
    const docId = knowledgeDocumentId(doc);
    if (isKnowledgeFolder(doc)) {
      router.push({
        pathname: '/knowledge/[kbId]',
        params: { kbId, prefix: knowledgeChildPrefix(doc) },
      });
      return;
    }
    if (!docId) {
      return;
    }
    router.push({
      pathname: '/knowledge/[kbId]/[docId]',
      params: { kbId, docId, title: knowledgeDocumentLabel(doc) },
    });
  };

  const title = prefix
    ? prefix.split('/').filter(Boolean).pop() || strings.knowledge.title
    : strings.knowledge.title;

  let body: ReactNode;
  if (current === null) {
    body = <SkeletonList rows={5} />;
  } else if (current.failed && current.docs.length === 0) {
    body = (
      <EmptyState
        icon={<CloudOff size={26} color={tokens.textTertiary} />}
        title={strings.knowledge.errorTitle}
        hint={strings.knowledge.errorHint}
        action={{ label: strings.chat.crashRetry, onPress: retry, testID: 'knowledge-docs-retry' }}
      />
    );
  } else if (current.docs.length === 0) {
    body = (
      <EmptyState
        icon={<FileText size={26} color={tokens.textTertiary} />}
        title={strings.knowledge.docsEmptyTitle}
        hint={strings.knowledge.docsEmptyHint}
      />
    );
  } else {
    body = (
      <View
        style={[
          styles.list,
          { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
          pending ? styles.dimmed : null,
        ]}
      >
        {current.docs.map((doc, index) => {
          const label = knowledgeDocumentLabel(doc);
          const folder = isKnowledgeFolder(doc);
          const docId = knowledgeDocumentId(doc) || label;
          return (
            <Pressable
              key={docId}
              accessibilityRole="button"
              accessibilityLabel={folder ? `${label}, ${strings.knowledge.folder}` : label}
              testID={`knowledge-doc-${docId}`}
              style={({ pressed }) => [
                styles.row,
                index < current.docs.length - 1
                  ? {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: tokens.borderSubtle,
                    }
                  : null,
                pressed ? { backgroundColor: tokens.overlayPressed } : null,
              ]}
              onPress={() => openDoc(doc)}
            >
              {folder ? (
                <Folder size={20} color={tokens.textSecondary} />
              ) : (
                <FileText size={20} color={tokens.textSecondary} />
              )}
              <Text style={[styles.title, { color: tokens.textPrimary }]} numberOfLines={1}>
                {label}
              </Text>
              {folder ? <ChevronRight size={18} color={tokens.textTertiary} /> : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]} testID="knowledge-docs">
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title={title} onBack={goBack} />
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
          {body}
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
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { ...typeScale.body, flex: 1 },
});
