import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';

import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { LogoHeader } from '@/components/icons';
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
import { classifyFetchFailure } from '@/platform/network-failure';
import { KeyboardAwareScrollView } from '@/platform/keyboard';
import { continuousCorners, layout, radius, typeScale, useTheme } from '@/theme';

type Step = 'server' | 'credentials';

/** Health probe client: no session, no token, no renewal. */
function probeClient(baseUrl: string): HttpClient {
  return new HttpClient({
    baseUrl,
    getToken: () => Promise.resolve(null),
    onTokenRenewed: () => Promise.resolve(),
    onUnauthorized: () => undefined,
  });
}

/**
 * Sign-in in two steps, matching how a self-hosted server is actually set up:
 *
 * 1. the server address — Next checks the connection before anything else is
 *    asked for, so an unreachable host is diagnosed before a password is typed;
 * 2. username and password — the address is already known and tested, shown
 *    above the fields with a way back to step 1.
 *
 * No marketing copy on either step: the screen says what to enter, what is
 * happening, and what went wrong.
 */
export function LoginScreen({ storage }: { storage?: SecureStorage }) {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const { login, baseUrl, sessionExpired, clearSessionExpired } = useAuth();
  const reduceMotion = useReducedMotion();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  // A known server means the address step is already done.
  const [step, setStep] = useState<Step>(baseUrl ? 'credentials' : 'server');
  const [url, setUrl] = useState(baseUrl ?? '');
  const [history, setHistory] = useState<ServerEntry[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!storage) {
      return;
    }
    let cancelled = false;
    void storage
      .get('servers.history')
      .then(raw => {
        if (!cancelled) {
          setHistory(parseServerList(raw));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const rememberServer = (base: string) => {
    if (!storage) {
      return;
    }
    void storage
      .get('servers.history')
      .then(raw => {
        const list = upsertServer(parseServerList(raw), base);
        setHistory(list);
        return storage.set('servers.history', serializeServerList(list));
      })
      .catch(() => undefined);
  };

  /** Step 1: normalize, probe the server, then move on. */
  const next = async () => {
    if (checking) {
      return;
    }
    setError(null);
    let base: string;
    try {
      base = normalizeBaseUrl(url.trim());
    } catch {
      setError(strings.login.errors.invalid_url);
      return;
    }
    setChecking(true);
    try {
      await new AuthApi(probeClient(base)).health();
      haptics.notify('success');
      setUrl(base);
      rememberServer(base);
      if (sessionExpired) {
        clearSessionExpired();
      }
      setStep('credentials');
    } catch (e) {
      haptics.notify('error');
      // A browser reports CORS and a dead host the same way; ask the platform
      // which one it is so the copy can name the actual problem.
      const failure =
        e instanceof OctopApiError && e.code === 'NETWORK_ERROR'
          ? await classifyFetchFailure(`${base}/api/health`)
          : null;
      setError(failure ? strings.login.errors[failure] : strings.login.errors.invalid_url);
    } finally {
      setChecking(false);
    }
  };

  const submit = () => {
    if (busy) {
      return;
    }
    setError(null);
    const user = username.trim();
    const run = () => {
      setBusy(true);
      void login(url, user, password)
        .then(() => haptics.notify('success'))
        .catch((e: unknown) => {
          haptics.notify('error');
          setError(
            e instanceof LoginFlowError
              ? strings.login.errors[e.code]
              : strings.login.errors.unknown,
          );
        })
        .finally(() => setBusy(false));
    };
    if (!isCleartext(url)) {
      run();
      return;
    }
    // Cleartext sends credentials unencrypted — a warning, so an alert is right.
    setBusy(true);
    void (async () => {
      const key = cleartextAckStorageKey(url);
      let acknowledged = false;
      if (storage) {
        try {
          acknowledged = (await storage.get(key)) === '1';
        } catch {
          acknowledged = false;
        }
      }
      if (acknowledged) {
        run();
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
              run();
            })();
          },
        },
      ]);
    })();
  };

  const backToServer = () => {
    if (busy) {
      return;
    }
    setError(null);
    setPassword('');
    setStep('server');
  };

  const displayError = error ?? (sessionExpired ? strings.login.errors.session_expired : null);
  const stepEntering = reduceMotion ? undefined : FadeIn.duration(160);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bg }}>
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
          {/* The wordmark is the brand asset, not styled text: it keeps the
              custom letterforms and the red dot over the "t". */}
          <View accessible accessibilityRole="header" accessibilityLabel={strings.appName}>
            <LogoHeader width={108} height={36} color={tokens.textPrimary} />
          </View>
        </View>

        {step === 'server' ? (
          <Animated.View key="server" entering={stepEntering} style={styles.form}>
            <Text accessibilityRole="header" style={[styles.title, { color: tokens.textPrimary }]}>
              {strings.login.serverTitle}
            </Text>
            <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
              {strings.login.serverSubtitle}
            </Text>

            <TextInput
              value={url}
              onChangeText={text => {
                setUrl(text);
                setError(null);
              }}
              testID="login-url"
              accessibilityLabel={strings.login.serverUrl}
              placeholder={strings.login.serverPlaceholder}
              placeholderTextColor={tokens.textPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoComplete="url"
              textContentType="URL"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => void next()}
              autoFocus
              selectionColor={tokens.accent}
              style={[
                styles.field,
                {
                  backgroundColor: tokens.overlaySubtle,
                  borderColor: url.trim() ? tokens.borderStrong : tokens.borderSubtle,
                  color: tokens.textBody,
                },
              ]}
            />

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={checking ? strings.login.checking : strings.login.next}
              accessibilityState={{ busy: checking, disabled: !url.trim() || checking }}
              testID="login-next"
              disabled={!url.trim() || checking}
              onPress={() => void next()}
              style={[
                styles.primary,
                {
                  // An inactive control reads as inactive by fill, not by
                  // fading the accent into an unreadable gray.
                  backgroundColor: !url.trim() || checking ? tokens.fill : tokens.accent,
                },
              ]}
            >
              {checking ? <ActivityIndicator size="small" color={tokens.textSecondary} /> : null}
              <Text
                style={[
                  styles.primaryText,
                  { color: !url.trim() || checking ? tokens.textTertiary : tokens.textInverse },
                ]}
              >
                {checking ? strings.login.checking : strings.login.next}
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

            {history.length > 0 ? (
              <View style={styles.recent}>
                <Text style={[styles.sectionLabel, { color: tokens.textTertiary }]}>
                  {strings.login.recent}
                </Text>
                <View
                  style={[
                    styles.recentCard,
                    continuousCorners,
                    { backgroundColor: tokens.surface },
                  ]}
                >
                  {history.slice(0, 3).map((entry, index, list) => (
                    <PressableScale
                      key={entry.url}
                      accessibilityRole="button"
                      accessibilityLabel={entry.label ?? entry.url}
                      testID={`login-recent-${index}`}
                      scaleTo={0.99}
                      dimTo={0.6}
                      onPress={() => {
                        setUrl(entry.url);
                        setError(null);
                      }}
                      style={[
                        styles.recentRow,
                        index < list.length - 1
                          ? { borderBottomWidth: StyleSheet.hairlineWidth }
                          : null,
                        index < list.length - 1 ? { borderBottomColor: tokens.separator } : null,
                      ]}
                    >
                      <Text
                        style={[styles.recentLabel, { color: tokens.textBody }]}
                        numberOfLines={1}
                      >
                        {entry.label ?? entry.url}
                      </Text>
                      {entry.label ? (
                        <Text
                          style={[styles.recentUrl, { color: tokens.textTertiary }]}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {entry.url}
                        </Text>
                      ) : null}
                    </PressableScale>
                  ))}
                </View>
              </View>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View key="credentials" entering={stepEntering} style={styles.form}>
            <View style={styles.stepHead}>
              <IconButton label={strings.login.back} testID="login-back" onPress={backToServer}>
                <ChevronLeft size={26} color={tokens.textBody} />
              </IconButton>
              <Text style={[styles.serverValue, { color: tokens.textSecondary }]} numberOfLines={1}>
                {url}
              </Text>
            </View>

            <Text
              accessibilityRole="header"
              style={[styles.title, styles.titleInset, { color: tokens.textPrimary }]}
            >
              {strings.login.credentialsTitle}
            </Text>
            <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
              {strings.login.credentialsSubtitle}
            </Text>

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
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              autoFocus
              selectionColor={tokens.accent}
              style={[
                styles.field,
                {
                  backgroundColor: tokens.overlaySubtle,
                  borderColor: tokens.borderStrong,
                  color: tokens.textBody,
                },
              ]}
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
                selectionColor={tokens.accent}
                style={[
                  styles.field,
                  styles.fieldWithIcon,
                  {
                    backgroundColor: tokens.overlaySubtle,
                    borderColor: tokens.borderStrong,
                    color: tokens.textBody,
                  },
                ]}
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
              style={[styles.primary, { backgroundColor: tokens.accent, opacity: busy ? 0.6 : 1 }]}
            >
              {busy ? <ActivityIndicator size="small" color={tokens.textInverse} /> : null}
              <Text style={[styles.primaryText, { color: tokens.textInverse }]}>
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

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={strings.login.changeServer}
              testID="login-change-server"
              scaleTo={1}
              dimTo={0.6}
              onPress={backToServer}
              style={styles.secondary}
            >
              <Text style={[styles.secondaryText, { color: tokens.accent }]}>
                {strings.login.changeServer}
              </Text>
            </PressableScale>
          </Animated.View>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const FIELD_HEIGHT = 52;

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 24,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 12,
  },
  logo: {
    width: 56,
    height: 53,
  },
  form: {
    marginTop: 40,
    gap: 12,
  },
  title: {
    ...typeScale.title2,
    marginBottom: 8,
  },
  subtitle: {
    ...typeScale.subheadline,
    marginBottom: 8,
  },
  titleInset: {
    marginLeft: 0,
    marginTop: 8,
  },
  stepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: -10,
  },
  serverValue: {
    ...typeScale.footnote,
    flexShrink: 1,
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
  primary: {
    flexDirection: 'row',
    gap: 8,
    minHeight: FIELD_HEIGHT,
    borderRadius: radius.input,
    ...continuousCorners,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryText: {
    ...typeScale.headline,
  },
  secondary: {
    alignSelf: 'center',
    minHeight: layout.hitTarget,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryText: {
    ...typeScale.subheadline,
    fontWeight: '500',
  },
  error: {
    ...typeScale.footnote,
  },
  recent: {
    marginTop: 16,
    gap: 6,
  },
  sectionLabel: {
    ...typeScale.footnote,
  },
  recentCard: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  recentRow: {
    minHeight: layout.rowMinHeight,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  recentLabel: {
    ...typeScale.body,
  },
  recentUrl: {
    ...typeScale.caption1,
  },
});
