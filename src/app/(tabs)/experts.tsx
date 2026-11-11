import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme';

/**
 * 专家 tab — pending design (the Ardot file scopes the chat surfaces);
 * rendered with the design's tokens so it stays consistent until then.
 */
export default function ExpertsScreen() {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();

  const tabBarFootprint = useTabBarFootprint();
  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={[styles.safe, { paddingBottom: tabBarFootprint }]}>
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
