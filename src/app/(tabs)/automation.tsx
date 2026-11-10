import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme';

/** 自动化 tab — pending design; same token-consistent placeholder. */
export default function AutomationScreen() {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={styles.safe}>
        <AppHeader onMenu={openDrawer} />
        <View style={styles.center}>
          <Text style={[styles.hint, { color: tokens.textTertiary }]}>
            {strings.common.pendingDesign}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingTop: 47 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 14, lineHeight: 22 },
});
