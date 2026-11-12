import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
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
  const [focused, setFocused] = useState<'old' | 'new' | 'confirm' | null>(null);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/me');
    }
  };

  const fieldStyle = (field: 'old' | 'new' | 'confirm') => [
    styles.field,
    {
      color: tokens.textPrimary,
      backgroundColor: tokens.surface,
      borderColor: focused === field ? tokens.accent : tokens.borderSubtle,
    },
  ];

  const submit = async () => {
    if (newPassword.length < MIN_LEN) {
      Alert.alert(strings.password.title, strings.password.tooShort);
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert(strings.password.title, strings.password.mismatch);
      return;
    }
    setBusy(true);
    try {
      await changePassword(oldPassword, newPassword);
      haptics.notify('success');
      Alert.alert(strings.password.title, strings.password.success, [
        { text: strings.common.ok, onPress: goBack },
      ]);
    } catch (error) {
      haptics.notify('error');
      const badOld = error instanceof OctopApiError && error.code === 'AUTH_FAILED';
      Alert.alert(
        strings.password.title,
        badOld ? strings.password.badOld : strings.password.failed,
      );
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = oldPassword.length > 0 && newPassword.length > 0 && confirm.length > 0 && !busy;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title={strings.password.title} onBack={goBack} />
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
            onChangeText={setOldPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            accessibilityLabel={strings.password.oldPassword}
            testID="password-old"
            onFocus={() => setFocused('old')}
            onBlur={() => setFocused(null)}
            style={fieldStyle('old')}
          />
          <Text style={[styles.label, { color: tokens.textTertiary }]}>
            {strings.password.newPassword}
          </Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel={strings.password.newPassword}
            testID="password-new"
            onFocus={() => setFocused('new')}
            onBlur={() => setFocused(null)}
            style={fieldStyle('new')}
          />
          <Text style={[styles.label, { color: tokens.textTertiary }]}>
            {strings.password.confirmPassword}
          </Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel={strings.password.confirmPassword}
            testID="password-confirm"
            onFocus={() => setFocused('confirm')}
            onBlur={() => setFocused(null)}
            style={fieldStyle('confirm')}
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={strings.password.submit}
            testID="password-submit"
            disabled={!canSubmit}
            scaleTo={0.98}
            style={[
              styles.submit,
              {
                backgroundColor: tokens.accent,
                opacity: canSubmit ? 1 : 0.4,
              },
            ]}
            onPress={() => void submit()}
          >
            {busy ? (
              <ActivityIndicator color={tokens.textInverse} />
            ) : (
              <Text style={[styles.submitLabel, { color: tokens.textInverse }]}>
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
    minHeight: layout.hitTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.input,
    ...continuousCorners,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
