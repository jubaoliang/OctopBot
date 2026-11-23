import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Copy, Settings, Trash2, Zap } from 'lucide-react-native';

import { PressableScale } from '@/components/PressableScale';
import { ScreenHeader, TOP_EDGES } from '@/platform/screen-header';
import { copyText } from '@/platform/clipboard';
import { openAppSettings } from '@/platform/linking';
import { HttpClient } from '@/core/api/http';
import { OctopApiError } from '@/core/api/errors';
import {
  clearConnectionEvents,
  formatConnectionEvent,
  logConnection,
  recentConnectionEvents,
  type ConnectionEvent,
} from '@/core/connection-log';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { CODE_FONT } from '@/theme/code-font';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

const HEALTH_TIMEOUT_MS = 10_000;

/**
 * Connection diagnostics: the recent socket/HTTP transitions, newest first,
 * as plain monospace lines the user can copy into a bug report. The log is
 * a bounded in-memory ring (see `core/connection-log.ts`) and never holds
 * message content, tokens or server addresses. A manual health probe gives
 * the user a way to re-run the connection test after fixing network or
 * server problems without signing out.
 */
export function ConnectionDiagnosticsScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { baseUrl } = useAuth();
  const [events, setEvents] = useState<readonly ConnectionEvent[]>(() => recentConnectionEvents());
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);

  // The screen stays mounted while sockets transition — keep the list live.
  useEffect(() => {
    const timer = setInterval(() => setEvents(recentConnectionEvents()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const lines = useMemo(() => [...events].reverse(), [events]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  };

  const copy = useCallback(async () => {
    const text = lines.map(formatConnectionEvent).join('\n');
    if (await copyText(text)) {
      setCopied(true);
    }
  }, [lines]);

  // The same anonymous health check the sign-in screen runs, recorded with
  // its round-trip time so a flaky network shows up as numbers, not vibes.
  const testConnection = useCallback(async () => {
    if (!baseUrl || testing) {
      return;
    }
    setTesting(true);
    const started = Date.now();
    const client = new HttpClient({
      baseUrl,
      getToken: async () => null,
      onTokenRenewed: async () => undefined,
      onUnauthorized: () => undefined,
      timeoutMs: HEALTH_TIMEOUT_MS,
    });
    try {
      await client.get('/api/health', { anonymous: true });
      logConnection({
        socket: 'http',
        status: 'ok',
        detail: `GET /api/health · ${Date.now() - started}ms`,
      });
    } catch (error) {
      const reason = error instanceof OctopApiError ? error.message : String(error);
      logConnection({
        socket: 'http',
        status: 'error',
        detail: `GET /api/health · ${reason} · ${Date.now() - started}ms`,
      });
    } finally {
      setTesting(false);
      setEvents(recentConnectionEvents());
    }
  }, [baseUrl, testing]);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]} testID="connection-diagnostics">
      <SafeAreaView edges={TOP_EDGES} style={styles.safe}>
        <ScreenHeader title={strings.settings.connectionDiagnostics} onBack={goBack} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <Text style={[styles.hint, { color: tokens.textSecondary }]}>
            {strings.settings.connectionDiagnosticsHint}
          </Text>
          <View style={styles.actions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={strings.settings.testConnection}
              accessibilityState={{ busy: testing }}
              disabled={!baseUrl || testing}
              onPress={() => void testConnection()}
              style={[
                styles.action,
                { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
              ]}
              testID="diagnostics-test"
            >
              {testing ? (
                <ActivityIndicator size="small" color={tokens.accent} />
              ) : (
                <Zap size={16} color={tokens.accent} />
              )}
              <Text style={[styles.actionLabel, { color: tokens.textPrimary }]}>
                {testing ? strings.settings.testingConnection : strings.settings.testConnection}
              </Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={strings.settings.copyDiagnostics}
              disabled={lines.length === 0}
              onPress={() => void copy()}
              style={[
                styles.action,
                { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
              ]}
              testID="diagnostics-copy"
            >
              <Copy size={16} color={tokens.accent} />
              <Text style={[styles.actionLabel, { color: tokens.textPrimary }]}>
                {copied ? strings.settings.diagnosticsCopied : strings.settings.copyDiagnostics}
              </Text>
            </PressableScale>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.settings.clearDiagnostics}
              disabled={lines.length === 0}
              onPress={() => {
                clearConnectionEvents();
                setEvents(recentConnectionEvents());
              }}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
                pressed ? { backgroundColor: tokens.overlayPressed } : null,
              ]}
              testID="diagnostics-clear"
            >
              <Trash2 size={16} color={tokens.textSecondary} />
              <Text style={[styles.actionLabel, { color: tokens.textSecondary }]}>
                {strings.settings.clearDiagnostics}
              </Text>
            </Pressable>
          </View>
          {lines.length === 0 ? (
            <Text style={[styles.empty, { color: tokens.textPlaceholder }]}>
              {strings.settings.diagnosticsEmpty}
            </Text>
          ) : (
            <View
              style={[
                styles.log,
                { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
              ]}
            >
              {lines.map((event, index) => (
                <Text
                  key={`${event.t}-${index}`}
                  selectable
                  style={[styles.line, { color: tokens.textBody, fontFamily: CODE_FONT }]}
                >
                  {formatConnectionEvent(event)}
                </Text>
              ))}
            </View>
          )}
          <View
            style={[
              styles.card,
              { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
            ]}
            testID="diagnostics-background-hint"
          >
            <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>
              {strings.settings.backgroundTitle}
            </Text>
            <Text style={[styles.cardBody, { color: tokens.textSecondary }]}>
              {strings.settings.backgroundHint}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.settings.openSystemSettings}
              onPress={() => void openAppSettings()}
              style={({ pressed }) => [
                styles.cardLink,
                pressed ? { backgroundColor: tokens.overlayPressed } : null,
              ]}
              testID="diagnostics-open-settings"
            >
              <Settings size={16} color={tokens.accent} />
              <Text style={[styles.cardLinkText, { color: tokens.accent }]}>
                {strings.settings.openSystemSettings}
              </Text>
            </Pressable>
          </View>
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
    gap: 16,
  },
  hint: { ...typeScale.footnote },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: layout.hitTarget,
    paddingHorizontal: 14,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    ...continuousCorners,
  },
  actionLabel: { ...typeScale.subheadline, fontWeight: '500' },
  empty: { ...typeScale.footnote, textAlign: 'center', paddingVertical: 24 },
  log: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    ...continuousCorners,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  line: { ...typeScale.caption1 },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    ...continuousCorners,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  cardTitle: { ...typeScale.headline },
  cardBody: { ...typeScale.footnote },
  cardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: layout.hitTarget,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    marginLeft: -8,
    borderRadius: radius.chip,
  },
  cardLinkText: { ...typeScale.subheadline, fontWeight: '500' },
});
