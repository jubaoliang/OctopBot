import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme';

/** 自动化 tab — pending design; same token-consistent placeholder. */
export default function AutomationScreen() {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();

  const tabBarFootprint = useTabBarFootprint();
  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={[styles.safe, { paddingBottom: tabBarFootprint }]}>
        <AppHeader onMenu={openDrawer} />
        <View style={styles.center}>
          <Text style={[styles.hint, { color: tokens.textTertiary }]}>
            {strings.common.pendingDesign}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingTop: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 14, lineHeight: 22 },
});
