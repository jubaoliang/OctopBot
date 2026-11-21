import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, Phone, Users } from 'lucide-react-native';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/platform/tab-bar';
import { useCalendarSync } from '@/features/calendar-sync-context';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { openAppSettings } from '@/platform/linking';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

/** `MM-dd HH:mm` last-sync stamp — locale-neutral and compact. */
function formatClock(epochMs: number): string {
  const date = new Date(epochMs);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Connect apps — the device capabilities the assistant can use, one card
 * per local app surface. Connect = the user turns the
 * capability on; everything is opt-in and the data scope is stated on the
 * card. Contacts and Phone are behavior cards (how sharing works); only
 * Calendar carries live state.
 */
export function ConnectAppsScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const router = useRouter();
  const tabBarFootprint = useTabBarFootprint();
  const {
    enabled,
    setEnabled,
    permission,
    calendars,
    lastSyncAt,
    syncing,
    syncNow,
    contactsEnabled,
    setContactsEnabled,
    contactsPermission,
  } = useCalendarSync();

  const onConnectToggle = useCallback(
    (next: boolean) => {
      haptics.selection();
      // The provider requests the OS permission itself when enabling.
      setEnabled(next);
    },
    [setEnabled],
  );

  const onContactsToggle = useCallback(
    (next: boolean) => {
      haptics.selection();
      setContactsEnabled(next);
    },
    [setContactsEnabled],
  );

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader
          title={strings.connectApps.title}
          onBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/chat');
            }
          }}
        />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarFootprint + 24 }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {/* Calendar — the live capability */}
          <View
            style={[
              styles.card,
              { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
            ]}
            testID="connect-calendar-card"
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: tokens.accentSoft }]}>
                <CalendarDays size={20} color={tokens.accent} />
              </View>
              <View style={styles.cardTitles}>
                <Text style={[styles.cardName, { color: tokens.textPrimary }]}>
                  {strings.connectApps.calendar}
                </Text>
                <Text style={[styles.cardScope, { color: tokens.textSecondary }]}>
                  {strings.connectApps.calendarScope}
                </Text>
              </View>
              <Switch
                accessibilityRole="switch"
                accessibilityLabel={strings.connectApps.calendar}
                value={enabled}
                onValueChange={onConnectToggle}
                trackColor={{ true: tokens.accent, false: tokens.overlayPressed }}
                thumbColor={tokens.surfaceRaised}
                ios_backgroundColor={tokens.overlayPressed}
                testID="connect-calendar-switch"
              />
            </View>
            {enabled && permission === 'denied' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={strings.connectApps.denied}
                testID="connect-calendar-denied"
                style={({ pressed }) => [
                  styles.syncRow,
                  pressed ? { backgroundColor: tokens.overlayPressed } : null,
                ]}
                onPress={() => openAppSettings()}
              >
                <Text style={[styles.syncMeta, { color: tokens.danger }]}>
                  {strings.connectApps.denied}
                </Text>
                <ChevronRight size={16} color={tokens.textPlaceholder} />
              </Pressable>
            ) : null}
            {enabled && permission === 'granted' ? (
              <View style={styles.cardBody}>
                {calendars.length === 0 ? (
                  <Text
                    style={[styles.hint, { color: tokens.textTertiary }]}
                    testID="connect-calendar-none"
                  >
                    {strings.settings.calendarSyncNone}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={strings.settings.calendarSyncNow}
                  testID="connect-calendar-sync-now"
                  disabled={syncing}
                  style={({ pressed }) => [
                    styles.syncRow,
                    pressed ? { backgroundColor: tokens.overlayPressed } : null,
                  ]}
                  onPress={() => void syncNow()}
                >
                  <Text style={[styles.syncLabel, { color: tokens.accent }]}>
                    {strings.settings.calendarSyncNow}
                  </Text>
                  <Text style={[styles.syncMeta, { color: tokens.textTertiary }]}>
                    {lastSyncAt
                      ? strings.settings.calendarSyncLast(formatClock(lastSyncAt))
                      : strings.connectApps.neverSynced}
                  </Text>
                  {syncing ? null : <ChevronRight size={16} color={tokens.textPlaceholder} />}
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Contacts — context capability: opt-in digest into the KB */}
          <View
            style={[
              styles.card,
              { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
            ]}
            testID="connect-contacts-card"
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: tokens.accentSoft }]}>
                <Users size={20} color={tokens.accent} />
              </View>
              <View style={styles.cardTitles}>
                <Text style={[styles.cardName, { color: tokens.textPrimary }]}>
                  {strings.connectApps.contacts}
                </Text>
                <Text style={[styles.cardScope, { color: tokens.textSecondary }]} numberOfLines={2}>
                  {strings.connectApps.contactsScope}
                </Text>
              </View>
              <Switch
                accessibilityRole="switch"
                accessibilityLabel={strings.connectApps.contacts}
                value={contactsEnabled}
                onValueChange={onContactsToggle}
                trackColor={{ true: tokens.accent, false: tokens.overlayPressed }}
                thumbColor={tokens.surfaceRaised}
                ios_backgroundColor={tokens.overlayPressed}
                testID="connect-contacts-switch"
              />
            </View>
            {contactsEnabled ? (
              <>
                <Text style={[styles.cardBodyText, { color: tokens.textSecondary }]}>
                  {strings.connectApps.contactsDetail}
                </Text>
                {contactsPermission === 'denied' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={strings.connectApps.denied}
                    testID="connect-contacts-denied"
                    style={({ pressed }) => [
                      styles.syncRow,
                      pressed ? { backgroundColor: tokens.overlayPressed } : null,
                    ]}
                    onPress={() => openAppSettings()}
                  >
                    <Text style={[styles.syncMeta, { color: tokens.danger }]}>
                      {strings.connectApps.denied}
                    </Text>
                    <ChevronRight size={16} color={tokens.textPlaceholder} />
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>

          {/* Phone — behavior card; actions ride reply links with a confirm */}
          <View
            style={[
              styles.card,
              { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
            ]}
            testID="connect-phone-card"
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: tokens.accentSoft }]}>
                <Phone size={20} color={tokens.accent} />
              </View>
              <View style={styles.cardTitles}>
                <Text style={[styles.cardName, { color: tokens.textPrimary }]}>
                  {strings.connectApps.phone}
                </Text>
                <Text style={[styles.cardScope, { color: tokens.textSecondary }]} numberOfLines={2}>
                  {strings.connectApps.phoneScope}
                </Text>
              </View>
            </View>
            <Text style={[styles.cardBodyText, { color: tokens.textSecondary }]}>
              {strings.connectApps.phoneDetail}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 8,
    gap: 16,
  },
  card: {
    borderRadius: radius.card,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitles: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    ...typeScale.body,
    fontWeight: '600',
  },
  cardScope: {
    ...typeScale.footnote,
  },
  cardBody: {
    gap: 8,
  },
  cardBodyText: {
    ...typeScale.footnote,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.hitTarget - 8,
    borderRadius: radius.pill,
    ...continuousCorners,
    paddingHorizontal: 8,
    gap: 8,
  },
  syncLabel: {
    ...typeScale.subheadline,
    fontWeight: '600',
  },
  syncMeta: {
    ...typeScale.footnote,
    flex: 1,
    textAlign: 'right',
  },
  hint: {
    ...typeScale.footnote,
  },
});
