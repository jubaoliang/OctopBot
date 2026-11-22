import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

import { ScreenHeader, TOP_EDGES } from '@/platform/screen-header';
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

/**
 * Stack highlights named in the article, grouped by role. Membership is
 * filtered against the generated data at render time, so a removed
 * dependency simply drops out of the prose instead of naming a ghost.
 */
const GROUPS: {
  key: 'runtime' | 'navigation' | 'motion' | 'device' | 'language';
  names: string[];
}[] = [
  { key: 'runtime', names: ['react', 'react-native', 'expo'] },
  {
    key: 'navigation',
    names: [
      'expo-router',
      'react-native-screens',
      'react-native-gesture-handler',
      'lucide-react-native',
    ],
  },
  { key: 'motion', names: ['react-native-reanimated', 'react-native-svg'] },
  {
    key: 'device',
    names: [
      'expo-calendar',
      'expo-contacts',
      'expo-secure-store',
      'expo-speech-recognition',
      'expo-audio',
      'expo-notifications',
    ],
  },
  { key: 'language', names: ['typescript'] },
];

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

/**
 * Open-source acknowledgements as a readable article: the stack described
 * by role, license-family distribution, and one expandable full text per
 * license family — not a row per package. Data still comes from the
 * generated `src/legal/licenses.json` (regenerate with `npm run licenses`).
 */
export function LicensesScreen() {
  const tokens = useTokens();
  const { t: strings, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>(null);

  const separator = locale.startsWith('zh') ? '、' : ', ';
  const present = useMemo(() => new Set(ENTRIES.map(entry => entry.name)), []);

  const families = useMemo(() => {
    const map = new Map<string, { count: number; text: string | null }>();
    for (const entry of ENTRIES) {
      const family = map.get(entry.license) ?? { count: 0, text: null };
      family.count += 1;
      if (!family.text && entry.licenseText) {
        family.text = entry.licenseText;
      }
      map.set(entry.license, family);
    }
    return [...map.entries()]
      .map(([license, value]) => ({ license, ...value }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const article = strings.licensesArticle;
  const paragraphs = GROUPS.map(group => ({
    key: group.key,
    text: fill(article[group.key], {
      names: group.names.filter(name => present.has(name)).join(separator),
    }),
  })).filter(paragraph => paragraph.text.trim().length > 0);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]} testID="licenses">
      <SafeAreaView edges={TOP_EDGES} style={styles.safe}>
        <ScreenHeader title={strings.settings.licenses} onBack={goBack} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.article} testID="licenses-article">
            <Text style={[styles.lead, { color: tokens.textBody }]}>
              {fill(article.lead, { count: ENTRIES.length })}
            </Text>
            {paragraphs.map(paragraph => (
              <Text key={paragraph.key} style={[styles.paragraph, { color: tokens.textBody }]}>
                {paragraph.text}
              </Text>
            ))}
            <Text style={[styles.paragraph, { color: tokens.textBody }]}>
              {fill(article.families, {
                summary: families
                  .map(family => `${family.license} ×${family.count}`)
                  .join(separator),
              })}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            {article.appendix}
          </Text>
          <View
            style={[
              styles.appendix,
              continuousCorners,
              { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
            ]}
          >
            {families.map((family, index) => {
              const open = expanded === family.license;
              const canExpand = Boolean(family.text);
              return (
                <View
                  key={family.license}
                  style={
                    index < families.length - 1
                      ? {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: tokens.separator,
                        }
                      : null
                  }
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${family.license} ${family.count}`}
                    testID={`license-family-${family.license}`}
                    disabled={!canExpand}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && canExpand ? { backgroundColor: tokens.overlayPressed } : null,
                    ]}
                    onPress={() => setExpanded(open ? null : family.license)}
                  >
                    <View style={styles.rowText}>
                      <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
                        {family.license}
                      </Text>
                      <Text style={[styles.meta, { color: tokens.textTertiary }]} numberOfLines={1}>
                        {fill(article.familyCount, { count: family.count })}
                      </Text>
                    </View>
                    {canExpand ? (
                      open ? (
                        <ChevronDown size={18} color={tokens.textTertiary} />
                      ) : (
                        <ChevronRight size={18} color={tokens.textTertiary} />
                      )
                    ) : null}
                  </Pressable>
                  {open && family.text ? (
                    <Text selectable style={[styles.licenseText, { color: tokens.textSecondary }]}>
                      {family.text}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Text style={[styles.footer, { color: tokens.textTertiary }]}>
            {strings.settings.licensesFooter}
          </Text>
        </ScrollView>
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
    gap: 16,
  },
  article: { gap: 12 },
  lead: { ...typeScale.body },
  paragraph: { ...typeScale.body },
  sectionTitle: { ...typeScale.headline },
  appendix: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
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
  footer: { ...typeScale.footnote },
});
