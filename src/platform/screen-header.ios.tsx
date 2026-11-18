import { useEffect, useLayoutEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ChevronLeft } from 'lucide-react-native';

import { LogoHeader } from '@/components/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { typeScale, useTokens } from '@/theme';

import type { ScreenHeaderProps } from './screen-header';

/** iOS renders the system navigation bar instead of a drawn one. */
export const NATIVE_HEADERS = true;

/** The navigation bar already clears the status bar. */
export const TOP_EDGES: Edge[] = [];

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/**
 * iOS screen chrome: nothing is drawn here — the information is handed to the
 * `UINavigationBar` of the enclosing stack, which brings the system blur, the
 * large title that collapses on scroll, the standard back button and the
 * correct metrics for the device.
 *
 * The screens keep passing the same props they pass on Android, so no screen
 * decides what platform it is on.
 */
export function ScreenHeader({
  title,
  subtitle,
  largeTitle,
  brand,
  onMenu,
  onBack,
}: ScreenHeaderProps) {
  const navigation = useNavigation();
  const { t: strings } = useI18n();
  const t = useTokens();
  // Callbacks are read through a ref so the options effect does not re-run on
  // every parent render (inline arrows change identity each time).
  const handlers = useRef({ onMenu, onBack });
  useEffect(() => {
    handlers.current = { onMenu, onBack };
  }, [onMenu, onBack]);
  const hasMenu = Boolean(onMenu);

  useLayoutEffect(() => {
    // A pushed screen gets the system back button; only a deep link with no
    // history behind it needs one drawn by hand.
    const needsFallbackBack = Boolean(onBack) && !navigation.canGoBack();
    navigation.setOptions({
      headerShown: true,
      headerTransparent: false,
      headerShadowVisible: false,
      headerTitleAlign: 'center',
      headerBackButtonDisplayMode: 'minimal',
      headerLargeTitleEnabled: Boolean(largeTitle),
      title: largeTitle ?? title ?? '',
      headerTitle: brand
        ? () => (
            <View accessible accessibilityLabel={strings.appName}>
              <LogoHeader width={60} height={20} color={t.textBody} />
            </View>
          )
        : subtitle
          ? () => (
              <View style={styles.titleStack}>
                <Text style={[styles.title, { color: t.textPrimary }]} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={[styles.subtitle, { color: t.textSecondary }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
            )
          : undefined,
      headerLeft: hasMenu
        ? () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={strings.a11y.menu}
              testID="header-menu"
              hitSlop={HIT_SLOP}
              onPress={() => handlers.current.onMenu?.()}
            >
              <SymbolView
                name="line.3.horizontal"
                size={20}
                weight="semibold"
                tintColor={t.textBody}
              />
            </Pressable>
          )
        : needsFallbackBack
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={strings.a11y.back}
                testID="header-back"
                hitSlop={HIT_SLOP}
                onPress={() => handlers.current.onBack?.()}
              >
                <ChevronLeft size={24} color={t.textBody} />
              </Pressable>
            )
          : undefined,
    });
  }, [
    navigation,
    brand,
    title,
    subtitle,
    largeTitle,
    hasMenu,
    onBack,
    strings.appName,
    strings.a11y.back,
    strings.a11y.menu,
    t.textBody,
    t.textPrimary,
    t.textSecondary,
  ]);

  return null;
}

const styles = StyleSheet.create({
  titleStack: {
    alignItems: 'center',
    gap: 1,
  },
  title: {
    ...typeScale.headline,
  },
  subtitle: {
    ...typeScale.caption2,
  },
});
