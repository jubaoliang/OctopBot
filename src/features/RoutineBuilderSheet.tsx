import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { ListGroup, ListRow } from '@/components/List';
import { AgentAvatar } from '@/components/AgentAvatar';
import { PressableScale } from '@/components/PressableScale';
import { CronApi } from '@/core/api/knowledge';
import type { AgentSummary } from '@/core/api/types';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { haptics } from '@/platform/haptics';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';
import {
  CRON_PRESETS,
  cronTrigger,
  isValidCronExpression,
  type CronPresetId,
} from '@/utils/cron-trigger';

type ScheduleChoice = CronPresetId | 'briefings' | 'custom';

const PRESET_ORDER: ScheduleChoice[] = [
  'daily',
  'weekdays',
  'weekly',
  'hourly',
  'briefings',
  'custom',
];

/**
 * The routine builder: pick an expert, say what it should do, choose when.
 * Presets cover the common rhythms; the briefings preset creates the
 * morning/evening pair in one tap; a custom cron expression is validated
 * before it leaves the device. Creation goes through the same CronApi the
 * roster toggles use — the server runs the turn and pushes the result.
 */
export function RoutineBuilderSheet({
  visible,
  onClose,
  agents,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  agents: AgentSummary[];
  onCreated: () => void;
}) {
  const t = useTokens();
  const { t: strings } = useI18n();
  const { httpClient } = useAuth();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState<ScheduleChoice>('daily');
  const [customExpr, setCustomExpr] = useState('');
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);

  const picked = agents.find(a => a.agent_id === agentId) ?? agents[0] ?? null;

  // The draft clears on dismiss (an event, not an effect), so the next open
  // starts fresh while the expert pick persists across openings.
  const dismiss = () => {
    setPrompt('');
    setCustomExpr('');
    setSchedule('daily');
    setFailed(false);
    onClose();
  };

  const presetLabel = (choice: ScheduleChoice): string => {
    switch (choice) {
      case 'daily':
        return strings.automation.presetDaily;
      case 'weekdays':
        return strings.automation.presetWeekdays;
      case 'weekly':
        return strings.automation.presetWeekly;
      case 'hourly':
        return strings.automation.presetHourly;
      case 'briefings':
        return strings.automation.presetBriefings;
      case 'custom':
        return strings.automation.customCron;
    }
  };

  const customValid = isValidCronExpression(customExpr);
  const canCreate =
    picked !== null &&
    !creating &&
    (schedule === 'briefings' || prompt.trim().length > 0) &&
    (schedule !== 'custom' || customValid);

  const create = async () => {
    if (!picked || !canCreate) {
      return;
    }
    setCreating(true);
    setFailed(false);
    const api = new CronApi(httpClient);
    try {
      if (schedule === 'briefings') {
        const morning = await api.create(picked.agent_id, {
          name: strings.automation.briefingMorningName,
          trigger: CRON_PRESETS.briefingMorning,
          prompt: strings.automation.briefingMorningPrompt,
          enabled: true,
        });
        try {
          await api.create(picked.agent_id, {
            name: strings.automation.briefingEveningName,
            trigger: CRON_PRESETS.briefingEvening,
            prompt: strings.automation.briefingEveningPrompt,
            enabled: true,
          });
        } catch (eveningError) {
          // The pair is one product: never leave a lone morning briefing
          // behind (a retry would duplicate it). Roll back, then surface.
          await api.remove(picked.agent_id, morning.id).catch(() => undefined);
          throw eveningError;
        }
      } else {
        const trigger = schedule === 'custom' ? cronTrigger(customExpr) : CRON_PRESETS[schedule];
        await api.create(picked.agent_id, { trigger, prompt: prompt.trim(), enabled: true });
      }
      haptics.notify('success');
      onCreated();
      dismiss();
    } catch {
      setFailed(true);
      haptics.notify('error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={dismiss}
      dismissLabel={strings.a11y.closeSheet}
      title={strings.automation.builderTitle}
      scroll
      testID="routine-builder"
    >
      <View style={styles.body}>
        <Text style={[styles.label, { color: t.textSecondary }]}>
          {strings.automation.expertLabel}
        </Text>
        {agents.length === 0 ? (
          <Text style={[styles.hint, { color: t.textTertiary }]}>{strings.chatHome.noExperts}</Text>
        ) : (
          <ListGroup>
            {agents.map((agent, index) => (
              <ListRow
                key={agent.agent_id}
                title={agent.name}
                leading={
                  <AgentAvatar
                    name={agent.name}
                    iconName={agent.icon_name}
                    color={agent.color}
                    size={24}
                    fallbackTextSecondary={t.textSecondary}
                  />
                }
                selected={picked?.agent_id === agent.agent_id}
                onPress={() => {
                  haptics.selection();
                  setAgentId(agent.agent_id);
                }}
                testID={`routine-expert-${agent.agent_id}`}
                last={index === agents.length - 1}
              />
            ))}
          </ListGroup>
        )}

        {schedule === 'briefings' ? (
          <Text style={[styles.hint, { color: t.textSecondary }]}>
            {strings.automation.briefingsHint}
          </Text>
        ) : (
          <>
            <Text style={[styles.label, { color: t.textSecondary }]}>
              {strings.automation.promptLabel}
            </Text>
            <TextInput
              style={[
                styles.promptField,
                continuousCorners,
                { backgroundColor: t.fill, color: t.textBody },
              ]}
              placeholder={strings.automation.promptPlaceholder}
              placeholderTextColor={t.textPlaceholder}
              selectionColor={t.accent}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              testID="routine-prompt"
            />
          </>
        )}

        <Text style={[styles.label, { color: t.textSecondary }]}>
          {strings.automation.scheduleLabel}
        </Text>
        <View style={styles.chips}>
          {PRESET_ORDER.map(choice => {
            const active = schedule === choice;
            return (
              <PressableScale
                key={choice}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? t.accentSoft : t.fill,
                  },
                ]}
                onPress={() => {
                  haptics.selection();
                  setSchedule(choice);
                }}
                testID={`routine-schedule-${choice}`}
              >
                <Text style={[styles.chipLabel, { color: active ? t.accent : t.textBody }]}>
                  {presetLabel(choice)}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {schedule === 'custom' ? (
          <>
            <TextInput
              style={[
                styles.cronField,
                continuousCorners,
                { backgroundColor: t.fill, color: t.textBody },
              ]}
              placeholder="0 9 * * *"
              placeholderTextColor={t.textPlaceholder}
              selectionColor={t.accent}
              autoCapitalize="none"
              autoCorrect={false}
              value={customExpr}
              onChangeText={setCustomExpr}
              testID="routine-cron"
            />
            {customExpr.trim().length > 0 && !customValid ? (
              <Text style={[styles.error, { color: t.danger }]}>
                {strings.automation.customCronInvalid}
              </Text>
            ) : null}
          </>
        ) : null}

        {failed ? (
          <Text style={[styles.error, { color: t.danger }]}>{strings.automation.createFailed}</Text>
        ) : null}

        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCreate }}
          disabled={!canCreate}
          style={[
            styles.create,
            { backgroundColor: t.accent },
            !canCreate ? styles.createDisabled : null,
          ]}
          onPress={() => void create()}
          testID="routine-create"
        >
          <Text style={[styles.createLabel, { color: t.textInverse }]}>
            {creating ? strings.automation.creating : strings.automation.create}
          </Text>
        </PressableScale>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: 8,
    gap: 12,
  },
  label: {
    ...typeScale.footnote,
    marginTop: 8,
  },
  hint: {
    ...typeScale.callout,
  },
  promptField: {
    ...typeScale.body,
    borderRadius: radius.card,
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: radius.pill,
    ...continuousCorners,
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipLabel: {
    ...typeScale.subheadline,
  },
  cronField: {
    ...typeScale.body,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    minHeight: layout.hitTarget,
  },
  error: {
    ...typeScale.footnote,
  },
  create: {
    borderRadius: radius.card,
    ...continuousCorners,
    minHeight: layout.hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  createDisabled: {
    opacity: 0.4,
  },
  createLabel: {
    ...typeScale.body,
    fontWeight: '600',
  },
});
