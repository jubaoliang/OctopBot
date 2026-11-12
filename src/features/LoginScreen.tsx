import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState, type ComponentRef } from 'react';
import Animated, { Easing, SlideInDown } from 'react-native-reanimated';

import { Eye, EyeOff } from 'lucide-react-native';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { AuthApi } from '@/core/api/auth';
import { OctopApiError } from '@/core/api/errors';
import { HttpClient } from '@/core/api/http';
import { cleartextAckStorageKey, isCleartext, normalizeBaseUrl } from '@/core/api/urls';
import {
  parseServerList,
  serializeServerList,
  upsertServer,
  type ServerEntry,
} from '@/core/servers';
import { type SecureStorage } from '@/platform/secure-storage';
import { LoginFlowError, useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { KeyboardAwareScrollView, KeyboardInsetView } from '@/platform/keyboard';
import { continuousCorners, layout, motion, radius, typeScale, useTheme } from '@/theme';

type Field = 'url' | 'username' | 'password';

// The server sheet rises on the iOS sheet curve while the scrim fades.
const SHEET_IN = SlideInDown.duration(motion.sheet).easing(Easing.bezier(0.32, 0.72, 0, 1));

/**
 * Sign-in per the original login design: brand block, server URL +
 * username + password fields, accent sign-in button, cleartext note.
 * Colors come from the token system (accent palette + light/dark).
 */
export function LoginScreen({ storage }: { storage?: SecureStorage }) {
  const { tokens } = useTheme();
  const { t: strings, locale } = useI18n();
  const { login, baseUrl, sessionExpired, clearSessionExpired } = useAuth();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState<Field | 'modalUrl' | null>(null);

  const [url, setUrl] = useState(baseUrl ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverModal, setServerModal] = useState(false);
  const [modalUrl, setModalUrl] = useState(baseUrl ?? '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<ServerEntry[]>([]);

  const testServer = async (rawUrl: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const base = normalizeBaseUrl(rawUrl.trim());
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
  };

  // Opening the sheet pre-fills the URL, loads the server history and
  // tests straight away, so a reachable server shows its latency at once
  // and an unreachable one is diagnosed up front.
  const openServerSheet = () => {
    setModalUrl(url);
    setTestResult(null);
    setServerModal(true);
    void storage
      ?.get('servers.history')
      .then(raw => setHistory(parseServerList(raw)))
      .catch(() => undefined);
    if (url.trim()) {
      void testServer(url);
    }
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Derive from auth flag — no setState-in-effect. Cleared on the next submit.
  const displayError = error ?? (sessionExpired ? strings.login.errors.session_expired : null);

  // The focused field trades its hairline for the accent, so the caret is
  // never the only sign of where typing will land.
  const fieldStyle = (field: Field | 'modalUrl') => ({
    backgroundColor: tokens.overlaySubtle,
    borderColor: focused === field ? tokens.accent : tokens.borderStrong,
    color: tokens.textBody,
  });

  const runLogin = (rawUrl: string, user: string, pass: string) => {
    setBusy(true);
    void login(rawUrl, user, pass)
      .then(() => haptics.notify('success'))
      .catch((e: unknown) => {
        haptics.notify('error');
        if (e instanceof LoginFlowError) {
          setError(strings.login.errors[e.code]);
        } else {
          setError(strings.login.errors.unknown);
        }
      })
      .finally(() => setBusy(false));
  };

  const submit = () => {
    if (busy) {
      return;
    }
    setError(null);
    if (sessionExpired) {
      clearSessionExpired();
    }
    let base: string;
    try {
      base = normalizeBaseUrl(url.trim());
    } catch {
      setError(strings.login.errors.invalid_url);
      return;
    }
    const user = username.trim();
    if (!isCleartext(base)) {
      runLogin(base, user, password);
      return;
    }
    // Block double-taps while we look up / prompt for the cleartext ack.
    setBusy(true);
    void (async () => {
      const key = cleartextAckStorageKey(base);
      let acknowledged = false;
      if (storage) {
        try {
          acknowledged = (await storage.get(key)) === '1';
        } catch {
          acknowledged = false;
        }
      }
      if (acknowledged) {
        runLogin(base, user, password);
        return;
      }
      setBusy(false);
      Alert.alert(strings.login.cleartextTitle, strings.login.cleartextMessage, [
        { text: strings.login.cancel, style: 'cancel' },
        {
          text: strings.login.cleartextContinue,
          onPress: () => {
            void (async () => {
              if (storage) {
                try {
                  await storage.set(key, '1');
                } catch {
                  // Persistence failure must not block the explicit continue.
                }
              }
              runLogin(base, user, password);
            })();
          },
        },
      ]);
    })();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bg }}>
      {/* The scroll view makes its own room for the keyboard and scrolls the
          focused field above it; wrapping it in a second avoider doubles up. */}
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
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
          <Text style={[styles.label, { color: tokens.textSecondary }]}>
            {strings.login.username}
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            testID="login-username"
            accessibilityLabel={strings.login.username}
            autoCapitalize="none"
            autoCorrect={false}
            // Lets the system offer saved credentials (Password AutoFill).
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            onFocus={() => setFocused('username')}
            onBlur={() => setFocused(null)}
            selectionColor={tokens.accent}
            style={[styles.field, fieldStyle('username')]}
          />

          <Text style={[styles.label, { color: tokens.textSecondary }]}>
            {strings.login.password}
          </Text>
          <View style={styles.fieldWrap}>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              testID="login-password"
              accessibilityLabel={strings.login.password}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              selectionColor={tokens.accent}
              style={[styles.field, styles.fieldWithIcon, fieldStyle('password')]}
            />
            <View style={styles.fieldIcon}>
              <IconButton
                label={showPassword ? strings.a11y.hidePassword : strings.a11y.showPassword}
                testID="login-toggle-password"
                onPress={() => setShowPassword(v => !v)}
              >
                {showPassword ? (
                  <EyeOff width={20} height={20} color={tokens.textTertiary} />
                ) : (
                  <Eye width={20} height={20} color={tokens.textTertiary} />
                )}
              </IconButton>
            </View>
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={busy ? strings.login.signingIn : strings.login.signIn}
            accessibilityState={{ busy, disabled: busy }}
            testID="login-submit"
            disabled={busy}
            onPress={submit}
            style={[styles.signIn, { backgroundColor: tokens.accent, opacity: busy ? 0.6 : 1 }]}
          >
            {busy ? <ActivityIndicator size="small" color={tokens.textInverse} /> : null}
            <Text style={[styles.signInText, { color: tokens.textInverse }]}>
              {busy ? strings.login.signingIn : strings.login.signIn}
            </Text>
          </PressableScale>

          {displayError ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.error, { color: tokens.danger }]}
            >
              {displayError}
            </Text>
          ) : null}

          <Text style={[styles.note, { color: tokens.textTertiary }]}>{strings.login.note}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${strings.login.serverUrl}, ${url || strings.login.serverPlaceholder}`}
          testID="login-server"
          onPress={openServerSheet}
          style={({ pressed }) => [styles.serverButton, pressed ? styles.dimmed : null]}
        >
          <Text style={[styles.serverLink, { color: tokens.textTertiary }]} numberOfLines={1}>
            {url || strings.login.serverPlaceholder}
          </Text>
        </Pressable>
        <Text style={[styles.footer, { color: tokens.textTertiary }]}>
          {locale === 'zh' ? 'Octop 移动客户端' : 'Octop mobile client'}
        </Text>
      </KeyboardAwareScrollView>
      <Modal
        visible={serverModal}
        transparent
        animationType="fade"
        onRequestClose={() => setServerModal(false)}
      >
        {/* The sheet has its own keyboard avoidance: a Modal is a separate
            window, so nothing on the screen behind it reaches it. */}
        <KeyboardInsetView style={{ flex: 1 }}>
          <Pressable
            accessibilityLabel={strings.login.cancel}
            style={[styles.modalScrim, { backgroundColor: tokens.scrim }]}
            onPress={() => setServerModal(false)}
          >
            <Animated.View entering={SHEET_IN}>
              <Pressable
                accessible={false}
                style={[
                  styles.modalCard,
                  {
                    backgroundColor: tokens.surface,
                    paddingBottom: Math.max(insets.bottom + 12, 24),
                  },
                ]}
                onPress={e => e.stopPropagation()}
              >
                <View style={[styles.modalHandle, { backgroundColor: tokens.borderStrong }]} />
                <Text
                  accessibilityRole="header"
                  style={[styles.modalTitle, { color: tokens.textPrimary }]}
                >
                  {strings.login.serverUrl}
                </Text>
                {history.length > 0 ? (
                  <View style={[styles.historyCard, { backgroundColor: tokens.overlaySubtle }]}>
                    {history.map(entry => (
                      <Pressable
                        key={entry.url}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.historyRow,
                          pressed ? { backgroundColor: tokens.overlayPressed } : null,
                        ]}
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
                  accessibilityLabel={strings.login.serverUrl}
                  autoComplete="url"
                  textContentType="URL"
                  returnKeyType="done"
                  placeholder="https://octop.example.com"
                  placeholderTextColor={tokens.textPlaceholder}
                  onFocus={() => setFocused('modalUrl')}
                  onBlur={() => setFocused(null)}
                  selectionColor={tokens.accent}
                  style={[styles.field, fieldStyle('modalUrl')]}
                />
                <PressableScale
                  accessibilityRole="button"
                  accessibilityState={{ busy: testing, disabled: testing || !modalUrl.trim() }}
                  disabled={testing || !modalUrl.trim()}
                  onPress={() => void testServer(modalUrl)}
                  style={[
                    styles.testButton,
                    { borderColor: tokens.borderStrong },
                    testing || !modalUrl.trim() ? styles.dimmed : null,
                  ]}
                >
                  {testing ? <ActivityIndicator size="small" color={tokens.textSecondary} /> : null}
                  <Text style={[styles.testButtonText, { color: tokens.textBody }]}>
                    {testing ? strings.login.testing : strings.login.testConnection}
                  </Text>
                </PressableScale>
                {testResult ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[
                      styles.testResult,
                      { color: testResult.ok ? tokens.success : tokens.danger },
                    ]}
                  >
                    {testResult.message}
                  </Text>
                ) : null}
                <View style={styles.modalActions}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !modalUrl.trim() }}
                    style={[
                      styles.sheetButton,
                      { backgroundColor: tokens.accent },
                      modalUrl.trim() ? null : styles.dimmed,
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
                    <Text style={[styles.sheetButtonText, { color: tokens.textInverse }]}>
                      {strings.login.save}
                    </Text>
                  </PressableScale>
                  <PressableScale
                    accessibilityRole="button"
                    onPress={() => setServerModal(false)}
                    scaleTo={1}
                    dimTo={0.6}
                    style={styles.sheetButton}
                  >
                    <Text style={[styles.sheetButtonText, { color: tokens.textSecondary }]}>
                      {strings.login.cancel}
                    </Text>
                  </PressableScale>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </KeyboardInsetView>
      </Modal>
    </SafeAreaView>
  );
}

/** Exposed for tests: field keys in visual order. */
export const LOGIN_FIELD_ORDER: Field[] = ['url', 'username', 'password'];

const FIELD_HEIGHT = 52;

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
    ...typeScale.largeTitle,
  },
  tagline: {
    ...typeScale.subheadline,
  },
  form: {
    gap: 12,
    marginTop: 40,
  },
  label: {
    ...typeScale.footnote,
    fontWeight: '500',
  },
  field: {
    // minHeight, not height: the field grows with Dynamic Type.
    minHeight: FIELD_HEIGHT,
    borderRadius: radius.input,
    ...continuousCorners,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...typeScale.body,
    // A set lineHeight clips the caret in single-line iOS fields.
    lineHeight: undefined,
  },
  fieldWrap: {
    justifyContent: 'center',
  },
  fieldWithIcon: {
    paddingRight: 52,
  },
  fieldIcon: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  serverButton: {
    alignSelf: 'center',
    minHeight: layout.hitTarget,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  serverLink: {
    ...typeScale.footnote,
    textAlign: 'center',
    textDecorationLine: 'underline',
    maxWidth: 280,
  },
  dimmed: {
    opacity: 0.5,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    ...continuousCorners,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 8,
  },
  historyCard: {
    borderRadius: radius.card,
    ...continuousCorners,
    overflow: 'hidden',
  },
  historyRow: {
    minHeight: layout.rowMinHeight,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  historyLabel: {
    ...typeScale.subheadline,
  },
  historyUrl: {
    ...typeScale.caption1,
  },
  modalTitle: {
    ...typeScale.headline,
  },
  testButton: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.input,
    ...continuousCorners,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.hitTarget,
    paddingVertical: 11,
  },
  testButtonText: {
    ...typeScale.subheadline,
    fontWeight: '500',
  },
  testResult: {
    ...typeScale.footnote,
  },
  modalActions: {
    gap: 6,
  },
  sheetButton: {
    borderRadius: radius.input,
    ...continuousCorners,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 12,
  },
  sheetButtonText: {
    ...typeScale.headline,
  },
  signIn: {
    flexDirection: 'row',
    gap: 8,
    minHeight: FIELD_HEIGHT,
    borderRadius: radius.input,
    ...continuousCorners,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  signInText: {
    ...typeScale.headline,
  },
  error: {
    ...typeScale.footnote,
  },
  note: {
    ...typeScale.caption1,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    ...typeScale.caption2,
    textAlign: 'center',
    marginTop: 16,
  },
});
