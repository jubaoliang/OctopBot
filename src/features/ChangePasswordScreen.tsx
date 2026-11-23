import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ScreenHeader, TOP_EDGES } from '@/platform/screen-header';
import { PressableScale } from '@/components/PressableScale';
import { OctopApiError } from '@/core/api/errors';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { KeyboardAwareScrollView } from '@/platform/keyboard';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

const MIN_LEN = 8;

/** Account password update — pushed from 我的. */
export function ChangePasswordScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const { changePassword } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/me');
    }
  };

  // Same field anatomy as the sign-in screen: tinted fill, 1pt border,
  // 52pt minimum so the row grows with Dynamic Type.
  const fieldStyle = [
    styles.field,
    {
      color: tokens.textBody,
      backgroundColor: tokens.overlaySubtle,
      borderColor: tokens.borderStrong,
    },
  ];

  const submit = async () => {
    // Validation lands inline under the fields, like sign-in — an alert
    // would interrupt for something the form itself can say (feedback.md).
    if (newPassword.length < MIN_LEN) {
      setError(strings.password.tooShort);
      return;
    }
    if (newPassword !== confirm) {
      setError(strings.password.mismatch);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await changePassword(oldPassword, newPassword);
      haptics.notify('success');
      Alert.alert(strings.password.title, strings.password.success, [
        { text: strings.common.ok, onPress: goBack },
      ]);
    } catch (cause) {
      haptics.notify('error');
      const badOld = cause instanceof OctopApiError && cause.code === 'AUTH_FAILED';
      setError(badOld ? strings.password.badOld : strings.password.failed);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = oldPassword.length > 0 && newPassword.length > 0 && confirm.length > 0 && !busy;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={TOP_EDGES} style={styles.safe}>
        <ScreenHeader title={strings.password.title} onBack={goBack} />
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.label, { color: tokens.textTertiary }]}>
            {strings.password.oldPassword}
          </Text>
          <TextInput
            value={oldPassword}
            onChangeText={text => {
              setOldPassword(text);
              setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            accessibilityLabel={strings.password.oldPassword}
            testID="password-old"
            style={fieldStyle}
          />
          <Text style={[styles.label, { color: tokens.textTertiary }]}>
            {strings.password.newPassword}
          </Text>
          <TextInput
            value={newPassword}
            onChangeText={text => {
              setNewPassword(text);
              setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel={strings.password.newPassword}
            testID="password-new"
            style={fieldStyle}
          />
          <Text style={[styles.label, { color: tokens.textTertiary }]}>
            {strings.password.confirmPassword}
          </Text>
          <TextInput
            value={confirm}
            onChangeText={text => {
              setConfirm(text);
              setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel={strings.password.confirmPassword}
            testID="password-confirm"
            style={fieldStyle}
          />
          {error ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.error, { color: tokens.danger }]}
            >
              {error}
            </Text>
          ) : null}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={strings.password.submit}
            testID="password-submit"
            disabled={!canSubmit}
            scaleTo={0.98}
            style={[
              styles.submit,
              // An inactive control reads as inactive by fill, not by
              // fading the accent into an unreadable gray (as on sign-in).
              { backgroundColor: canSubmit ? tokens.accent : tokens.fill },
            ]}
            onPress={() => void submit()}
          >
            {busy ? (
              <ActivityIndicator color={tokens.textSecondary} />
            ) : (
              <Text
                style={[
                  styles.submitLabel,
                  { color: canSubmit ? tokens.textInverse : tokens.textTertiary },
                ]}
              >
                {strings.password.submit}
              </Text>
            )}
          </PressableScale>
        </KeyboardAwareScrollView>
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
    gap: 8,
  },
  label: {
    ...typeScale.footnote,
    marginTop: 12,
  },
  field: {
    ...typeScale.body,
    // A set lineHeight clips the caret in single-line iOS fields.
    lineHeight: undefined,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.input,
    ...continuousCorners,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  error: {
    ...typeScale.footnote,
    marginTop: 4,
  },
  submit: {
    marginTop: 24,
    minHeight: layout.hitTarget,
    borderRadius: radius.input,
    ...continuousCorners,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    ...typeScale.headline,
  },
});
