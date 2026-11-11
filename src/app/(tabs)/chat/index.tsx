import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react-native';

import { AppHeader } from '@/components/AppHeader';
import { useTabBarFootprint } from '@/components/DesignTabBar';
import { ChatInput } from '@/components/ChatInput';
import { SuggestionPill } from '@/components/ChatPieces';
import { AgentAvatar } from '@/components/AgentAvatar';
import type { AgentSummary, QuickPrompts } from '@/core/api/types';
import { AgentsApi } from '@/core/api/agents';
import { useAuth } from '@/features/auth';
import { useAppShell } from '@/features/app-shell';
import { useI18n } from '@/i18n/I18nProvider';
import { useTokens } from '@/theme';

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
        const last = await httpClientLastAgent();
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
    setSelected(agent);
    setPickerOpen(false);
    void storageSetLastAgent(agent.agent_id);
  }, []);

  const startChat = (promptText: string | null) => {
    if (!selected) {
      return;
    }
    router.push({
      pathname: '/chat/[threadId]',
      params: {
        threadId: promptText ?? 'new',
        agent: selected.agent_id,
        title: selected.name,
      },
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={[styles.safe, { paddingBottom: tabBarFootprint }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
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

            {/* Expert selector */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="select-expert"
              style={({ pressed }) => [
                styles.selector,
                { backgroundColor: tokens.surface, opacity: pressed ? 0.85 : 1 },
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
            </Pressable>
            {pickerOpen ? (
              <View style={[styles.pickerList, { backgroundColor: tokens.surface }]}>
                <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                  {agents.map(agent => (
                    <Pressable
                      key={agent.agent_id}
                      accessibilityRole="button"
                      accessibilityLabel={agent.name}
                      style={({ pressed }) => [
                        styles.pickerRow,
                        {
                          backgroundColor:
                            selected?.agent_id === agent.agent_id
                              ? tokens.overlaySubtle
                              : 'transparent',
                        },
                        pressed ? { opacity: 0.7 } : null,
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
              </View>
            ) : null}

            <View style={styles.pills}>
              {(prompts.length > 0 ? prompts : strings.chatHome.suggestions).map(label => (
                <SuggestionPill key={label} label={label} onPress={() => startChat(label)} />
              ))}
            </View>
            <View style={styles.spacerBottom} />
          </View>
          <View style={styles.inputWrap}>
            <ChatInput onSend={text => startChat(text)} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// Secure-storage helpers for the last-used expert id (module-scoped so the
// mount effect can read without prop drilling).
let lastAgentGetter: (() => Promise<string | null>) | null = null;
let lastAgentSetter: ((id: string) => Promise<void>) | null = null;

/** Injected by AppShellProvider once storage is available. */
export function registerLastAgentStore(
  get: () => Promise<string | null>,
  set: (id: string) => Promise<void>,
): void {
  lastAgentGetter = get;
  lastAgentSetter = set;
}

function httpClientLastAgent(): Promise<string | null> {
  return lastAgentGetter ? lastAgentGetter() : Promise.resolve(null);
}

function storageSetLastAgent(id: string): Promise<void> {
  return lastAgentSetter ? lastAgentSetter(id) : Promise.resolve();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
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
  selector: {
    marginTop: 24,
    marginLeft: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  selectorName: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    maxWidth: 260,
  },
  pickerList: {
    marginTop: 6,
    marginLeft: 8,
    borderRadius: 12,
    maxHeight: 260,
    overflow: 'hidden',
  },
  pickerScroll: {
    flexGrow: 0,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  pickerEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
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
