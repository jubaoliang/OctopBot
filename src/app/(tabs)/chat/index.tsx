import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react-native';

import { ScreenHeader, TOP_EDGES } from '@/platform/screen-header';
import { useTabBarFootprint } from '@/platform/tab-bar';
import { BottomSheet } from '@/components/BottomSheet';
import { ChatInput } from '@/components/ChatInput';
import { SuggestionPill } from '@/components/ChatPieces';
import { AgentAvatar } from '@/components/AgentAvatar';
import { ListGroup, ListRow } from '@/components/List';
import { PressableScale } from '@/components/PressableScale';
import type { AgentSummary, TurnAttachment } from '@/core/api/types';
import { AgentsApi } from '@/core/api/agents';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { putChatHandoff } from '@/features/chat-handoff';
import { readLastAgentId, writeLastAgentId } from '@/features/last-agent-store';
import { useImageAttachments } from '@/features/useImageAttachments';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { KeyboardInsetView } from '@/platform/keyboard';
import { continuousCorners, layout, typeScale, useTokens } from '@/theme';
import {
  resolveLocalized,
  resolveQuickPrompts,
  type QuickPromptChoice,
} from '@/utils/quick-prompts';

/**
 * 聊天首屏 (design 2:365) — mascot, greeting, suggestion pills, composer.
 * Pills come from the selected expert's server quick_prompts (a tap drafts
 * the prompt body, never auto-sends); the expert picker persists the last
 * choice in secure storage.
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
  const [prompts, setPrompts] = useState<QuickPromptChoice[]>([]);
  // The expert's own greeting line (server welcome_message), when present.
  const [welcome, setWelcome] = useState<string | null>(null);
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
      setWelcome(null);
      return;
    }
    let cancelled = false;
    // Clear the previous expert's copy at once: a pill tap while the new
    // welcome is in flight must never draft A's template for B.
    setPrompts([]);
    setWelcome(null);
    void new AgentsApi(httpClient)
      .welcome(selected.agent_id)
      .then(w => {
        if (cancelled) {
          return;
        }
        setPrompts(resolveQuickPrompts(w.quick_prompts ?? null, locale));
        setWelcome(resolveLocalized(w.welcome_message ?? null, locale));
      })
      .catch(() => {
        // `main` has no welcome endpoint (404); the generic fallback covers it.
        if (!cancelled) {
          setPrompts([]);
          setWelcome(null);
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

  // Experts without their own prompts (and `main`, which has no welcome
  // endpoint) fall back to a generic personal-assistant set.
  const fallbackChoices = useMemo<QuickPromptChoice[]>(
    () => strings.chatHome.suggestions.map(s => ({ label: s, text: s })),
    [strings.chatHome.suggestions],
  );
  const choices = prompts.length > 0 ? prompts : fallbackChoices;

  // One navigation path for the composer and the pills. `draft` seeds the
  // thread's composer with the prompt body (templates need the user's
  // content) instead of auto-sending; staged chips ride along either way.
  // Only the chips actually handed off are cleared — an upload still in
  // flight stays on the home composer instead of being silently wiped.
  const startChat = (
    promptText: string | null,
    attachments?: TurnAttachment[],
    mode: 'send' | 'draft' = 'send',
    handedOffIds?: string[],
  ) => {
    if (!selected) {
      return;
    }
    // Attachments hand off in memory — never through route params.
    const hasAttachments = attachments !== undefined && attachments.length > 0;
    const handoff =
      hasAttachments || mode === 'draft'
        ? putChatHandoff(promptText ?? '', attachments ?? [], mode)
        : null;
    handedOffIds?.forEach(id => attachmentFlow.remove(id));
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
      <SafeAreaView edges={TOP_EDGES} style={styles.safe}>
        {/* The composer rests above the tab bar and rides the keyboard. */}
        <KeyboardInsetView
          restingInset={tabBarFootprint}
          gap={layout.keyboardGap}
          style={styles.fill}
        >
          <ScreenHeader
            brand
            onMenu={openDrawer}
            onCompose={selected ? () => startChat(null) : undefined}
          />
          {/* Scrolls only when the keyboard leaves less room than the
              content needs; at rest the spacers center it as designed. */}
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
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
            {welcome ? (
              <Text testID="home-welcome" style={[styles.welcome, { color: tokens.textSecondary }]}>
                {welcome}
              </Text>
            ) : null}

            {/* Expert selector — opens a sheet, so the pick never reflows the
                home screen behind it. */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                selected
                  ? `${strings.a11y.selectExpert}, ${selected.name}`
                  : strings.a11y.selectExpert
              }
              testID="select-expert"
              style={[
                styles.selector,
                { backgroundColor: tokens.surface, shadowColor: tokens.shadowSoft },
              ]}
              onPress={() => setPickerOpen(true)}
            >
              {selected ? (
                <>
                  <AgentAvatar
                    name={selected.name}
                    iconName={selected.icon_name}
                    iconUrl={selected.icon_url}
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

            <View style={styles.pills}>
              {choices.map((choice, index) => (
                <SuggestionPill
                  key={`${choice.label}-${index}`}
                  label={choice.label}
                  iconName={choice.iconName}
                  onPress={() => {
                    const ready = attachmentFlow.pending.filter(
                      p => p.status === 'ready' && p.attachment,
                    );
                    startChat(
                      choice.text,
                      ready.flatMap(p => (p.attachment ? [p.attachment] : [])),
                      'draft',
                      ready.map(p => p.id),
                    );
                  }}
                />
              ))}
            </View>
            <View style={styles.spacerBottom} />
          </ScrollView>
          <View style={styles.inputWrap}>
            <ChatInput
              onSend={(text, attachments) =>
                startChat(
                  text,
                  attachments,
                  'send',
                  attachmentFlow.pending.filter(p => p.status === 'ready').map(p => p.id),
                )
              }
              onPickImages={selected ? attachmentFlow.pick : undefined}
              pendingAttachments={attachmentFlow.pending}
              onRemovePending={attachmentFlow.remove}
            />
          </View>
        </KeyboardInsetView>

        <BottomSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          dismissLabel={strings.a11y.closeSheet}
          title={strings.chatHome.chooseExpert}
          subtitle={strings.chatHome.chooseExpertHint}
          scroll
          testID="expert-sheet"
        >
          <View style={styles.sheetBody}>
            {agents.length > 0 ? (
              <ListGroup>
                {agents.map((agent, index) => (
                  <ListRow
                    key={agent.agent_id}
                    title={agent.name}
                    subtitle={agent.description ?? undefined}
                    leading={
                      <AgentAvatar
                        name={agent.name}
                        iconName={agent.icon_name}
                        iconUrl={agent.icon_url}
                        color={agent.color}
                        size={32}
                        fallbackTextSecondary={tokens.textSecondary}
                      />
                    }
                    selected={selected?.agent_id === agent.agent_id}
                    last={index === agents.length - 1}
                    testID={`expert-option-${agent.agent_id}`}
                    onPress={() => pickAgent(agent)}
                  />
                ))}
              </ListGroup>
            ) : (
              <Text style={[styles.sheetEmpty, { color: tokens.textSecondary }]}>
                {strings.chatHome.noExperts}
              </Text>
            )}
          </View>
        </BottomSheet>
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
    paddingHorizontal: layout.screenMargin,
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
  // Greeting, selector, pills and the composer share one leading edge:
  // the 16pt screen margin, no extra insets.
  greeting: {
    marginTop: 6,
    ...typeScale.title2,
  },
  welcome: {
    marginTop: 4,
    ...typeScale.callout,
  },
  selector: {
    marginTop: 20,
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
  sheetBody: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sheetEmpty: {
    ...typeScale.subheadline,
    textAlign: 'center',
    paddingVertical: 24,
  },
  pills: {
    marginTop: 20,
    // Design: 12 between suggestion pills.
    gap: 12,
    alignItems: 'flex-start',
  },
  inputWrap: {
    paddingHorizontal: layout.screenMargin,
  },
});
