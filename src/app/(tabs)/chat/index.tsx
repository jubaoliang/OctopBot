import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { ChatInput } from '@/components/ChatInput';
import { SuggestionPill } from '@/components/ChatPieces';
import { AgentAvatar } from '@/components/AgentAvatar';
import { PressableScale } from '@/components/PressableScale';
import type { AgentSummary, QuickPrompts, TurnAttachment } from '@/core/api/types';
import { AgentsApi } from '@/core/api/agents';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { putChatHandoff } from '@/features/chat-handoff';
import { readLastAgentId, writeLastAgentId } from '@/features/last-agent-store';
import { useImageAttachments } from '@/features/useImageAttachments';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { KeyboardInsetView } from '@/platform/keyboard';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

// Module scope: layout-animation builders are not rebuilt per render.
const PICKER_IN = FadeIn.duration(150);

/** Normalize the server's quick_prompts payload to a flat string list. */
export function quickPromptList(payload: QuickPrompts, locale: string): string[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload.filter(s => typeof s === 'string');
  }
  const localized = locale.startsWith('zh') ? payload.zh : payload.en;
  const list = localized ?? payload.zh ?? payload.en ?? [];
  return Array.isArray(list) ? list.filter(s => typeof s === 'string') : [];
}

/**
 * 聊天首屏 (design 2:365) — mascot, greeting, suggestion pills, composer.
 * Pills come from the selected expert's server quick_prompts; the expert
 * picker persists the last choice in secure storage.
 */
export default function ChatHomeScreen() {
  const tokens = useTokens();
  const { t: strings, locale } = useI18n();
  const { openDrawer } = useAppShell();
  const { httpClient, user, ready } = useAuth();
  const router = useRouter();
  const tabBarFootprint = useTabBarFootprint();

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [selected, setSelected] = useState<AgentSummary | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  // Uploads target the selected expert's workspace; switching experts drops chips.
  const attachmentFlow = useImageAttachments(selected?.agent_id ?? 'main');

  // Load roster, restore the last-used expert (falls back to `main`).
  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const agents = await new AgentsApi(httpClient).list();
        if (cancelled) {
          return;
        }
        const last = await readLastAgentId();
        const pick =
          agents.find(a => a.agent_id === last) ??
          agents.find(a => a.agent_id === 'main') ??
          agents[0] ??
          null;
        if (pick) {
          // Both setStates run after awaits inside the loader — the rule
          // cannot see past the IIFE, so disable per-call.

          setAgents(agents);

          setSelected(pick);
        }
      } catch {
        // Roster stays empty; picker shows the error-free empty state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, httpClient]);

  // Fetch the selected expert's quick prompts whenever the pick changes.
  useEffect(() => {
    if (!selected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on the null branch only
      setPrompts([]);
      return;
    }
    let cancelled = false;
    void new AgentsApi(httpClient)
      .welcome(selected.agent_id)
      .then(w => {
        if (cancelled) {
          return;
        }
        setPrompts(quickPromptList((w.quick_prompts as QuickPrompts) ?? null, locale));
      })
      .catch(() => {
        if (!cancelled) {
          setPrompts([]);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.agent_id, locale, httpClient]);

  const pickAgent = useCallback((agent: AgentSummary) => {
    haptics.selection();
    setSelected(agent);
    setPickerOpen(false);
    void writeLastAgentId(agent.agent_id);
  }, []);

  const startChat = (promptText: string | null, attachments?: TurnAttachment[]) => {
    if (!selected) {
      return;
    }
    // Attachments hand off in memory — never through route params.
    const hasAttachments = attachments !== undefined && attachments.length > 0;
    const handoff = hasAttachments ? putChatHandoff(promptText ?? '', attachments) : null;
    if (hasAttachments) {
      attachmentFlow.clear();
    }
    router.push({
      pathname: '/chat/[threadId]',
      params: {
        // Never put prompt text in the path segment — deep links can forge
        // that and would auto-send. Internal prompts use a dedicated param.
        threadId: 'new',
        agent: selected.agent_id,
        title: selected.name,
        ...(handoff ? { handoff } : promptText ? { prompt: promptText } : {}),
      },
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* The composer rests above the tab bar and rides the keyboard. */}
        <KeyboardInsetView
          restingInset={tabBarFootprint}
          gap={layout.keyboardGap}
          style={styles.fill}
        >
          <AppHeader onMenu={openDrawer} />
          {/* Scrolls only when the keyboard leaves less room than the
              content needs; at rest the spacers center it as designed. */}
          <ScrollView
            style={styles.fill}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            <View style={styles.spacerTop} />
            <Image
              source={require('@/assets/images/mascot.png')}
              style={styles.mascot}
              resizeMode="contain"
            />
            <Text
              accessibilityRole="header"
              style={[styles.greeting, { color: tokens.textPrimary }]}
            >
              {strings.chatHome.greeting}
            </Text>

            {/* Expert selector */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                selected
                  ? `${strings.a11y.selectExpert}, ${selected.name}`
                  : strings.a11y.selectExpert
              }
              accessibilityState={{ expanded: pickerOpen }}
              testID="select-expert"
              style={[
                styles.selector,
                { backgroundColor: tokens.surface, shadowColor: tokens.shadowSoft },
              ]}
              onPress={() => setPickerOpen(v => !v)}
            >
              {selected ? (
                <>
                  <AgentAvatar
                    name={selected.name}
                    iconName={selected.icon_name}
                    color={selected.color}
                    size={24}
                    fallbackTextSecondary={tokens.textSecondary}
                  />
                  <Text
                    style={[styles.selectorName, { color: tokens.textPrimary }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {selected.name}
                  </Text>
                </>
              ) : (
                <Text
                  style={[styles.selectorName, { color: tokens.textTertiary }]}
                  numberOfLines={1}
                >
                  {strings.chatHome.pickExpert}
                </Text>
              )}
              <ChevronDown size={18} color={tokens.textTertiary} />
            </PressableScale>
            {pickerOpen ? (
              <Animated.View
                entering={PICKER_IN}
                style={[
                  styles.pickerList,
                  { backgroundColor: tokens.surface, borderColor: tokens.borderSubtle },
                ]}
              >
                <ScrollView
                  style={styles.pickerScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                >
                  {agents.map(agent => (
                    <Pressable
                      key={agent.agent_id}
                      accessibilityRole="radio"
                      accessibilityLabel={agent.name}
                      accessibilityState={{ selected: selected?.agent_id === agent.agent_id }}
                      style={({ pressed }) => [
                        styles.pickerRow,
                        {
                          backgroundColor:
                            selected?.agent_id === agent.agent_id
                              ? tokens.overlaySubtle
                              : 'transparent',
                        },
                        pressed ? { backgroundColor: tokens.overlayPressed } : null,
                      ]}
                      onPress={() => pickAgent(agent)}
                    >
                      <AgentAvatar
                        name={agent.name}
                        iconName={agent.icon_name}
                        color={agent.color}
                        size={20}
                        fallbackTextSecondary={tokens.textSecondary}
                      />
                      <Text
                        style={[styles.pickerName, { color: tokens.textBody }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {agent.name}
                      </Text>
                    </Pressable>
                  ))}
                  {agents.length === 0 ? (
                    <Text style={[styles.pickerEmpty, { color: tokens.textTertiary }]}>
                      {strings.chatHome.noExperts}
                    </Text>
                  ) : null}
                </ScrollView>
              </Animated.View>
            ) : null}

            <View style={styles.pills}>
              {(prompts.length > 0 ? prompts : strings.chatHome.suggestions).map(label => (
                <SuggestionPill key={label} label={label} onPress={() => startChat(label)} />
              ))}
            </View>
            <View style={styles.spacerBottom} />
          </ScrollView>
          <View style={styles.inputWrap}>
            <ChatInput
              onSend={(text, attachments) => startChat(text, attachments)}
              onPickImages={selected ? attachmentFlow.pick : undefined}
              pendingAttachments={attachmentFlow.pending}
              onRemovePending={attachmentFlow.remove}
            />
          </View>
        </KeyboardInsetView>
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
  fill: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: 12,
  },
  spacerTop: {
    flex: 78,
  },
  spacerBottom: {
    flex: 125,
    // Keeps the last pill clear of the composer when the content scrolls.
    minHeight: 12,
  },
  mascot: {
    width: 132,
    height: 132,
    alignSelf: 'flex-start',
  },
  // Greeting, selector and pills share one leading edge (12 + 8 = 20pt).
  greeting: {
    marginTop: 6,
    marginHorizontal: 8,
    ...typeScale.title2,
  },
  selector: {
    marginTop: 20,
    marginLeft: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: layout.hitTarget,
    borderRadius: layout.hitTarget / 2,
    ...continuousCorners,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
    // Same lift as the suggestion pills below it.
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 1,
  },
  selectorName: {
    ...typeScale.callout,
    fontWeight: '500',
    maxWidth: 260,
  },
  pickerList: {
    marginTop: 6,
    marginHorizontal: 8,
    borderRadius: radius.card,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 264,
    overflow: 'hidden',
  },
  pickerScroll: {
    flexGrow: 0,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: layout.rowMinHeight,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickerName: {
    flex: 1,
    ...typeScale.callout,
  },
  pickerEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...typeScale.subheadline,
  },
  pills: {
    marginTop: 20,
    marginLeft: 8,
    // Design: 12 between suggestion pills.
    gap: 12,
    alignItems: 'flex-start',
  },
  inputWrap: {
    paddingHorizontal: layout.screenMargin,
  },
});
