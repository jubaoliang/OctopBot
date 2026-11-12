import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

import { AppHeader } from '@/components/AppHeader';
import { useI18n } from '@/i18n/I18nProvider';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';
import licenses from '@/legal/licenses.json';

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  licenseText?: string;
}

const ENTRIES = licenses as LicenseEntry[];

/** Open-source acknowledgements — generated production dependency licenses. */
export function LicensesScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => [...ENTRIES].sort((a, b) => a.name.localeCompare(b.name)), []);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  };

  const renderItem = useCallback(
    ({ item, index }: { item: LicenseEntry; index: number }) => {
      const key = `${item.name}@${item.version}`;
      const open = expanded === key;
      const canExpand = Boolean(item.licenseText);
      let chevron = null;
      if (canExpand) {
        chevron = open ? (
          <ChevronDown size={18} color={tokens.textTertiary} />
        ) : (
          <ChevronRight size={18} color={tokens.textTertiary} />
        );
      }
      return (
        <View
          style={[
            index < rows.length - 1
              ? {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: tokens.borderSubtle,
                }
              : null,
            index === 0
              ? {
                  borderTopLeftRadius: radius.card,
                  borderTopRightRadius: radius.card,
                  ...continuousCorners,
                }
              : null,
            index === rows.length - 1
              ? {
                  borderBottomLeftRadius: radius.card,
                  borderBottomRightRadius: radius.card,
                  ...continuousCorners,
                }
              : null,
            { backgroundColor: tokens.surface },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${item.name} ${item.license}`}
            testID={`license-${item.name}`}
            disabled={!canExpand}
            style={({ pressed }) => [
              styles.row,
              pressed && canExpand ? { backgroundColor: tokens.overlayPressed } : null,
            ]}
            onPress={() => setExpanded(open ? null : key)}
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.meta, { color: tokens.textTertiary }]} numberOfLines={1}>
                {item.version} · {item.license}
              </Text>
            </View>
            {chevron}
          </Pressable>
          {open && item.licenseText ? (
            <Text selectable style={[styles.licenseText, { color: tokens.textSecondary }]}>
              {item.licenseText}
            </Text>
          ) : null}
        </View>
      );
    },
    [expanded, rows.length, tokens],
  );

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]} testID="licenses">
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title={strings.settings.licenses} onBack={goBack} />
        <FlatList
          data={rows}
          keyExtractor={item => `${item.name}@${item.version}`}
          renderItem={renderItem}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.footer, { color: tokens.textTertiary }]}>
              {strings.settings.licensesFooter}
            </Text>
          }
        />
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
    gap: 12,
  },
  footer: {
    ...typeScale.footnote,
    marginBottom: 12,
  },
  row: {
    minHeight: layout.hitTarget,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowText: { flex: 1, gap: 2 },
  name: { ...typeScale.subheadline },
  meta: { ...typeScale.caption1 },
  licenseText: {
    ...typeScale.caption1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
