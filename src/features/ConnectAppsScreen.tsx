import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, MessageSquare, Phone, Users } from 'lucide-react-native';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/platform/tab-bar';
import { useCalendarSync } from '@/features/calendar-sync-context';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { openAppSettings } from '@/platform/linking';
import { telephony } from '@/platform/telephony';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

/**
 * Connect apps — per-capability consent for the device tools this phone
 * advertises to the user's experts (from any client). Nothing is synced or
 * uploaded: reads happen on demand, writes/actions confirm in conversation,
 * and dial/compose hand off to the OS. The switch is the consent gate; the
 * OS permission is recovered in Settings when denied.
 */
export function ConnectAppsScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const router = useRouter();
  const tabBarFootprint = useTabBarFootprint();
  const { consent, setConsent, permission, contactsPermission, smsPermission, calendars } =
    useCalendarSync();

  const toggle = useCallback(
    (patch: Parameters<typeof setConsent>[0]) => {
      haptics.selection();
      setConsent(patch);
    },
    [setConsent],
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
          {/* Calendar — read + create, on demand */}
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
                value={consent.calendar}
                onValueChange={next => toggle({ calendar: next })}
                trackColor={{ true: tokens.accent, false: tokens.overlayPressed }}
                thumbColor={tokens.surfaceRaised}
                ios_backgroundColor={tokens.overlayPressed}
                testID="connect-calendar-switch"
              />
            </View>
            {consent.calendar && permission === 'denied' ? (
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
            {consent.calendar && permission === 'granted' && calendars.length === 0 ? (
              <Text
                style={[styles.hint, { color: tokens.textTertiary }]}
                testID="connect-calendar-none"
              >
                {strings.settings.calendarSyncNone}
              </Text>
            ) : null}
          </View>

          {/* Contacts — read on demand */}
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
                value={consent.contacts}
                onValueChange={next => toggle({ contacts: next })}
                trackColor={{ true: tokens.accent, false: tokens.overlayPressed }}
                thumbColor={tokens.surfaceRaised}
                ios_backgroundColor={tokens.overlayPressed}
                testID="connect-contacts-switch"
              />
            </View>
            {consent.contacts && contactsPermission === 'denied' ? (
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
          </View>

          {/* SMS — read on demand, send after the in-conversation card */}
          {telephony.supported ? (
            <View
              style={[
                styles.card,
                { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
              ]}
              testID="connect-sms-card"
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: tokens.accentSoft }]}>
                  <MessageSquare size={20} color={tokens.accent} />
                </View>
                <View style={styles.cardTitles}>
                  <Text style={[styles.cardName, { color: tokens.textPrimary }]}>
                    {strings.connectApps.sms}
                  </Text>
                  <Text
                    style={[styles.cardScope, { color: tokens.textSecondary }]}
                    numberOfLines={2}
                  >
                    {strings.connectApps.smsScope}
                  </Text>
                </View>
                <Switch
                  accessibilityRole="switch"
                  accessibilityLabel={strings.connectApps.sms}
                  value={consent.sms}
                  onValueChange={next => toggle({ sms: next })}
                  trackColor={{ true: tokens.accent, false: tokens.overlayPressed }}
                  thumbColor={tokens.surfaceRaised}
                  ios_backgroundColor={tokens.overlayPressed}
                  testID="connect-sms-switch"
                />
              </View>
              {consent.sms && smsPermission === 'denied' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={strings.connectApps.denied}
                  testID="connect-sms-denied"
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
            </View>
          ) : null}

          {/* Phone & mail — confirmed in conversation, direct or OS hand-off */}
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
              <Switch
                accessibilityRole="switch"
                accessibilityLabel={strings.connectApps.phone}
                value={consent.actions}
                onValueChange={next => toggle({ actions: next })}
                trackColor={{ true: tokens.accent, false: tokens.overlayPressed }}
                thumbColor={tokens.surfaceRaised}
                ios_backgroundColor={tokens.overlayPressed}
                testID="connect-actions-switch"
              />
            </View>
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
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.hitTarget - 8,
    borderRadius: radius.pill,
    ...continuousCorners,
    paddingHorizontal: 8,
    gap: 8,
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
