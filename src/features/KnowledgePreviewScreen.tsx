import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CloudOff, FileText } from 'lucide-react-native';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState, SkeletonList } from '@/components/ListStates';
import { KnowledgeApi } from '@/core/api/knowledge';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { layout, typeScale, useTokens } from '@/theme';
import { firstRouteParam } from '@/utils/route-params';

/** Plain-text preview of a knowledge document. */
export function KnowledgePreviewScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const { httpClient, user, ready } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    kbId?: string | string[];
    docId?: string | string[];
    title?: string | string[];
  }>();
  const kbId = firstRouteParam(params.kbId);
  const docId = firstRouteParam(params.docId);
  const title = firstRouteParam(params.title) || strings.knowledge.title;

  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback((): Promise<void> => {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    return (async () => {
      if (!kbId || !docId) {
        if (seq === requestSeq.current) {
          setFailed(true);
          setPending(false);
          setRefreshing(false);
        }
        return;
      }
      try {
        const next = await new KnowledgeApi(httpClient).preview(kbId, docId);
        if (seq !== requestSeq.current) {
          return;
        }
        setText(next);
        setFailed(false);
      } catch {
        if (seq !== requestSeq.current) {
          return;
        }
        setFailed(true);
      } finally {
        if (seq === requestSeq.current) {
          setPending(false);
          setRefreshing(false);
        }
      }
    })();
  }, [httpClient, kbId, docId]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    void load();
  }, [ready, user, kbId, docId, load]);

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
    } else if (kbId) {
      router.replace({ pathname: '/knowledge/[kbId]', params: { kbId } });
    } else {
      router.replace('/knowledge');
    }
  };

  const trimmed = text?.trim() ?? '';

  let body: ReactNode;
  if (pending && text === null) {
    body = <SkeletonList rows={6} />;
  } else if (failed && text === null) {
    body = (
      <EmptyState
        icon={<CloudOff size={26} color={tokens.textTertiary} />}
        title={strings.knowledge.previewError}
        hint={strings.knowledge.errorHint}
        action={{
          label: strings.chat.crashRetry,
          onPress: retry,
          testID: 'knowledge-preview-retry',
        }}
      />
    );
  } else if (!trimmed) {
    body = (
      <EmptyState
        icon={<FileText size={26} color={tokens.textTertiary} />}
        title={strings.knowledge.docsEmptyTitle}
        hint={strings.knowledge.docsEmptyHint}
      />
    );
  } else {
    body = (
      <Text
        selectable
        style={[styles.body, { color: tokens.textBody }, pending ? styles.dimmed : null]}
        testID="knowledge-preview-text"
      >
        {text}
      </Text>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]} testID="knowledge-preview">
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
    flexGrow: 1,
  },
  body: {
    ...typeScale.body,
  },
  dimmed: { opacity: 0.55 },
});
