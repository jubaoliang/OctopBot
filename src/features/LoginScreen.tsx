import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';

import { Eye, EyeOff, Pencil } from 'lucide-react-native';
import { AuthApi } from '@/core/api/auth';
import { OctopApiError } from '@/core/api/errors';
import { HttpClient } from '@/core/api/http';
import { normalizeBaseUrl } from '@/core/api/urls';
import {
  parseServerList,
  serializeServerList,
  upsertServer,
  type ServerEntry,
} from '@/core/servers';
import { type SecureStorage } from '@/platform/secure-storage';
import { LoginFlowError, useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme';

type Field = 'url' | 'username' | 'password';

/**
 * Sign-in per the original login design: brand block, server URL +
 * username + password fields, accent sign-in button, cleartext note.
 * Colors come from the token system (accent palette + light/dark).
 */
export function LoginScreen({ storage }: { storage?: SecureStorage }) {
  const { tokens } = useTheme();
  const { t: strings, locale } = useI18n();
  const { login, baseUrl } = useAuth();

  const [url, setUrl] = useState(baseUrl ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverModal, setServerModal] = useState(false);
  const [modalUrl, setModalUrl] = useState(baseUrl ?? '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<ServerEntry[]>([]);

  // Pre-fill + auto-test when the sheet opens, so a reachable server shows
  // the latency immediately and an unreachable one is diagnosed up front.
  useEffect(() => {
    if (!serverModal) {
      return;
    }
    void storage
      ?.get('servers.history')
      .then(raw => setHistory(parseServerList(raw)))
      .catch(() => undefined);
    if (!modalUrl.trim()) {
      return;
    }
    void (async () => {
      // Async continuation keeps setState out of the effect body.
      setTesting(true);
      setTestResult(null);
      try {
        const base = normalizeBaseUrl(modalUrl.trim());
        const started = Date.now();
        const client = new HttpClient({
          baseUrl: base,
          getToken: () => Promise.resolve(null),
          onTokenRenewed: () => Promise.resolve(),
          onUnauthorized: () => undefined,
        });
        await new AuthApi(client).health();
        setTestResult({
          ok: true,
          message: `${strings.login.testOk} (${Date.now() - started}ms)`,
        });
      } catch (e) {
        const code =
          e instanceof OctopApiError && e.code === 'NETWORK_ERROR' ? 'unreachable' : 'invalid_url';
        setTestResult({ ok: false, message: strings.login.errors[code] });
      } finally {
        setTesting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverModal]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldStyle = {
    backgroundColor: tokens.overlaySubtle,
    borderColor: tokens.borderStrong,
    color: tokens.textBody,
  };

  const submit = () => {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    void login(url.trim(), username.trim(), password)
      .catch((e: unknown) => {
        if (e instanceof LoginFlowError) {
          setError(strings.login.errors[e.code]);
        } else {
          setError(strings.login.errors.unknown);
        }
      })
      .finally(() => setBusy(false));
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image
              source={require('@/assets/images/mascot.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.brandName, { color: tokens.textPrimary }]}>Octop</Text>
            <Text style={[styles.tagline, { color: tokens.textSecondary }]}>
              {strings.login.tagline}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.serverRow}>
              <Text style={[styles.serverEntryLabel, { color: tokens.textTertiary }]}>
                {strings.login.serverUrl}
              </Text>
              <Text
                style={[styles.serverEntryValue, { color: tokens.textBody }]}
                numberOfLines={1}
                ellipsizeMode="middle"
                onPress={() => {
                  setModalUrl(url);
                  setTestResult(null);
                  setServerModal(true);
                }}
              >
                {url || strings.login.serverPlaceholder}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="login-server"
                testID="login-server"
                style={({ pressed }) => [
                  styles.serverPencil,
                  {
                    backgroundColor: tokens.overlaySubtle,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => {
                  setModalUrl(url);
                  setTestResult(null);
                  setServerModal(true);
                }}
              >
                <Pencil size={14} color={tokens.textBody} />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: tokens.textSecondary }]}>
              {strings.login.username}
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              testID="login-username"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.field, fieldStyle]}
            />

            <Text style={[styles.label, { color: tokens.textSecondary }]}>
              {strings.login.password}
            </Text>
            <View style={styles.fieldWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                testID="login-password"
                secureTextEntry={!showPassword}
                onSubmitEditing={submit}
                style={[styles.field, styles.fieldWithIcon, fieldStyle]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'hide-password' : 'show-password'}
                onPress={() => setShowPassword(v => !v)}
                style={styles.fieldIcon}
              >
                {showPassword ? (
                  <EyeOff width={20} height={20} color={tokens.textTertiary} />
                ) : (
                  <Eye width={20} height={20} color={tokens.textTertiary} />
                )}
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="login-submit"
              disabled={busy}
              onPress={submit}
              style={[styles.signIn, { backgroundColor: tokens.accent, opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={[styles.signInText, { color: tokens.textInverse }]}>
                {busy ? strings.login.signingIn : strings.login.signIn}
              </Text>
            </Pressable>

            {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}

            <Text style={[styles.note, { color: tokens.textTertiary }]}>{strings.login.note}</Text>
          </View>
          <Text style={[styles.footer, { color: tokens.textTertiary }]}>
            {locale === 'zh' ? 'Octop 移动客户端' : 'Octop mobile client'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={serverModal}
        transparent
        animationType="fade"
        onRequestClose={() => setServerModal(false)}
      >
        <Pressable
          style={[styles.modalScrim, { backgroundColor: tokens.scrim }]}
          onPress={() => setServerModal(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: tokens.surface }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: tokens.borderStrong }]} />
            <Text style={[styles.modalTitle, { color: tokens.textPrimary }]}>
              {strings.login.serverUrl}
            </Text>
            {history.length > 0 ? (
              <View style={[styles.historyCard, { backgroundColor: tokens.overlaySubtle }]}>
                {history.map(entry => (
                  <Pressable
                    key={entry.url}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.historyRow, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => {
                      setModalUrl(entry.url);
                      setTestResult(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.historyLabel,
                        { color: entry.label ? tokens.textBody : tokens.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {entry.label ?? entry.url}
                    </Text>
                    {entry.label ? (
                      <Text
                        style={[styles.historyUrl, { color: tokens.textTertiary }]}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {entry.url}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextInput
              value={modalUrl}
              onChangeText={setModalUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://octop.example.com"
              placeholderTextColor={tokens.textPlaceholder}
              style={[styles.field, fieldStyle]}
            />
            <Pressable
              accessibilityRole="button"
              disabled={testing}
              onPress={() => {
                setTesting(true);
                setTestResult(null);
                void (async () => {
                  try {
                    const base = normalizeBaseUrl(modalUrl.trim());
                    const started = Date.now();
                    const client = new HttpClient({
                      baseUrl: base,
                      getToken: () => Promise.resolve(null),
                      onTokenRenewed: () => Promise.resolve(),
                      onUnauthorized: () => undefined,
                    });
                    await new AuthApi(client).health();
                    setTestResult({
                      ok: true,
                      message: `${strings.login.testOk} (${Date.now() - started}ms)`,
                    });
                  } catch (e) {
                    const code =
                      e instanceof OctopApiError && e.code === 'NETWORK_ERROR'
                        ? 'unreachable'
                        : 'invalid_url';
                    setTestResult({ ok: false, message: strings.login.errors[code] });
                  } finally {
                    setTesting(false);
                  }
                })();
              }}
              style={[
                styles.testButton,
                { borderColor: tokens.borderStrong },
                testing ? { opacity: 0.6 } : null,
              ]}
            >
              <Text style={[styles.testButtonText, { color: tokens.textBody }]}>
                {testing ? strings.login.testing : strings.login.testConnection}
              </Text>
            </Pressable>
            {testResult ? (
              <Text
                style={[
                  styles.testResult,
                  { color: testResult.ok ? tokens.textBody : tokens.danger },
                ]}
              >
                {testResult.message}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                style={[
                  styles.sheetButton,
                  { backgroundColor: tokens.overlaySubtle },
                  modalUrl.trim() ? null : { opacity: 0.5 },
                ]}
                disabled={!modalUrl.trim()}
                onPress={() => {
                  const trimmed = normalizeBaseUrl(modalUrl.trim());
                  setUrl(trimmed);
                  void storage
                    ?.get('servers.history')
                    .then(raw => {
                      const list = upsertServer(parseServerList(raw), trimmed);
                      return storage
                        ?.set('servers.history', serializeServerList(list))
                        .then(() => setHistory(list));
                    })
                    .catch(() => undefined);
                  setServerModal(false);
                }}
              >
                <Text style={[styles.sheetButtonText, { color: tokens.textBody }]}>
                  {strings.login.save}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setServerModal(false)}
                style={styles.sheetButton}
              >
                <Text style={[styles.sheetButtonText, { color: tokens.textSecondary }]}>
                  {strings.login.cancel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/** Exposed for tests: field keys in visual order. */
export const LOGIN_FIELD_ORDER: Field[] = ['url', 'username', 'password'];

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 41,
    paddingBottom: 24,
  },
  brand: {
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 72,
    height: 68,
  },
  brandName: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '600',
  },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    gap: 12,
    marginTop: 40,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  field: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  fieldWrap: {
    justifyContent: 'center',
  },
  fieldWithIcon: {
    paddingRight: 48,
  },
  fieldIcon: {
    position: 'absolute',
    right: 14,
    height: 52,
    justifyContent: 'center',
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  serverEntryLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  serverEntryValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  serverPencil: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  historyCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  historyRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  historyLabel: {
    fontSize: 15,
    lineHeight: 22,
  },
  historyUrl: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  testButton: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  testButtonText: {
    fontSize: 15,
    lineHeight: 22,
  },
  testResult: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalActions: {
    gap: 10,
  },
  sheetButton: {
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  sheetButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  signIn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  signInText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 24,
  },
});
