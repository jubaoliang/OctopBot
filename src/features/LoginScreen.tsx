import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

import { LoginFlowError, useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme';

type Field = 'url' | 'username' | 'password';

/**
 * Sign-in per the original login design: brand block, server URL +
 * username + password fields, accent sign-in button, cleartext note.
 * Colors come from the token system (accent palette + light/dark).
 */
export function LoginScreen() {
  const { tokens } = useTheme();
  const { t: strings, locale } = useI18n();
  const { login, baseUrl } = useAuth();

  const [url, setUrl] = useState(baseUrl ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
            <Text style={[styles.label, { color: tokens.textSecondary }]}>
              {strings.login.serverUrl}
            </Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              testID="login-url"
              placeholder="https://octop.example.com"
              placeholderTextColor={tokens.textPlaceholder}
              style={[styles.field, fieldStyle]}
            />

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
            <TextInput
              value={password}
              onChangeText={setPassword}
              testID="login-password"
              secureTextEntry
              onSubmitEditing={submit}
              style={[styles.field, fieldStyle]}
            />

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
