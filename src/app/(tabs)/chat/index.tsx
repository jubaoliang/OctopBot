import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { ChatInput } from '@/components/ChatInput';
import { SuggestionPill } from '@/components/ChatPieces';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme';

/**
 * 聊天首屏 (design 2:365) — mascot, greeting, suggestion pills, composer.
 * Flex spacers (78/125) reproduce the frame's vertical rhythm.
 */
export default function ChatHomeScreen() {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={styles.safe}>
        <AppHeader onMenu={openDrawer} />
        <View style={styles.body}>
          <View style={styles.spacerTop} />
          <Image
            source={require('@/assets/images/mascot.png')}
            style={styles.mascot}
            resizeMode="contain"
          />
          <Text style={[styles.greeting, { color: tokens.textPrimary }]}>
            {strings.chatHome.greeting}
          </Text>
          <View style={styles.pills}>
            {strings.chatHome.suggestions.map(label => (
              <SuggestionPill
                key={label}
                label={label}
                onPress={() => router.push('/chat/demo-thread')}
              />
            ))}
          </View>
          <View style={styles.spacerBottom} />
        </View>
        <View style={styles.inputWrap}>
          <ChatInput />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingTop: 47, // status-bar band per frame
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
  },
  spacerTop: {
    flex: 78,
  },
  spacerBottom: {
    flex: 125,
  },
  mascot: {
    width: 132,
    height: 132,
    alignSelf: 'flex-start',
  },
  greeting: {
    marginTop: 6,
    marginLeft: 11,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
  },
  pills: {
    marginTop: 24,
    marginLeft: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  inputWrap: {
    paddingHorizontal: 16,
  },
});
