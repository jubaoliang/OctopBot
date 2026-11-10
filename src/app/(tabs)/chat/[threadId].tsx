import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { ChatInput } from '@/components/ChatInput';
import { CodeChip, LinkRow, ProcessCard, UserBubble } from '@/components/ChatPieces';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme';

/**
 * 主聊天 (design 2:299) — thread view with user bubble, process summary,
 * tool artifacts, assistant paragraphs, inline code chip, accent link.
 * Demo content mirrors the design frame until the chat socket is wired.
 */
export default function ThreadScreen() {
  const { tokens } = useTheme();
  const { t: strings } = useI18n();
  const { openDrawer } = useAppShell();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={styles.safe}>
        <AppHeader title={threadId} subtitle={strings.chat.agentName} onMenu={openDrawer} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <UserBubble text="帮我打开腾讯云官网" />
          <ProcessCard tools={6} thinking={7} />
          <View style={styles.artifactRow}>
            {/* Design placeholders — real tool artifacts render here once wired. */}
            <View style={[styles.artifactPlaceholder, { backgroundColor: tokens.overlaySubtle }]} />
            <View style={[styles.artifactPlaceholder, { backgroundColor: tokens.overlaySubtle }]} />
          </View>
          <View style={styles.assistant}>
            <Text style={[styles.assistantText, { color: tokens.textBody }]}>
              已经帮你打开了腾讯云相关的页面，不过看起来它自动跳转到了一个活动页面（“在云端秒级部署
              OpenClaw全能助手”）。
            </Text>
            <View style={styles.inlineRow}>
              <Text style={[styles.assistantText, { color: tokens.textBody }]}>
                这个可能是浏览器的默认跳转。你可以直接在浏览器地址栏输入
              </Text>
              <CodeChip text="cloud.tencent.com" />
            </View>
            <Text style={[styles.assistantText, { color: tokens.textBody }]}>
              {strings.chat.askMore}
            </Text>
            <LinkRow label={strings.chat.viewBrowser} />
          </View>
        </ScrollView>
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
    paddingTop: 47,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 33,
    gap: 24,
    paddingBottom: 24,
  },
  artifactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  artifactPlaceholder: {
    width: 240,
    height: 138,
    borderRadius: 8,
  },
  assistant: {
    gap: 16,
    alignItems: 'flex-start',
  },
  assistantText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  inputWrap: {
    paddingHorizontal: 16,
  },
});
