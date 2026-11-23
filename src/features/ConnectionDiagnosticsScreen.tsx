import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Copy, Trash2 } from 'lucide-react-native';

import { PressableScale } from '@/components/PressableScale';
import { ScreenHeader, TOP_EDGES } from '@/platform/screen-header';
import { copyText } from '@/platform/clipboard';
import {
  clearConnectionEvents,
  formatConnectionEvent,
  recentConnectionEvents,
  type ConnectionEvent,
} from '@/core/connection-log';
import { useI18n } from '@/i18n/I18nProvider';
import { CODE_FONT } from '@/theme/code-font';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

/**
 * Connection diagnostics: the recent socket/HTTP transitions, newest first,
 * as plain monospace lines the user can copy into a bug report. The log is
 * a bounded in-memory ring (see `core/connection-log.ts`) and never holds
 * message content, tokens or server addresses.
 */
export function ConnectionDiagnosticsScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<readonly ConnectionEvent[]>(() => recentConnectionEvents());
  const [copied, setCopied] = useState(false);

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
});
