import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChartNoAxesColumn, CloudOff } from 'lucide-react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { AgentAvatar } from '@/components/AgentAvatar';
import { AnimatedCount } from '@/components/AnimatedCount';
import { AppHeader } from '@/components/AppHeader';
import { BarChart } from '@/components/BarChart';
import { EmptyState, SkeletonList } from '@/components/ListStates';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SettingsSection } from '@/components/Settings';
import { OctopApiError } from '@/core/api/errors';
import type { AgentSummary, UsageBucket, UsageSummary } from '@/core/api/types';
import { UsageApi } from '@/core/api/usage';
import { fetchAgents, useAuth } from '@/features/auth';
import { useI18n } from '@/i18n/I18nProvider';
import { layout, motion, typeScale, useTokens } from '@/theme';
import {
  formatCompactCount,
  formatDayLabel,
  formatDayShort,
  formatExactCount,
  formatShare,
  usageCountDisplay,
} from '@/utils/usage-format';
import { dailySeries, rankBuckets, type RankedRow } from '@/utils/usage-series';

type WindowId = 'today' | 'last_7d' | 'last_30d' | 'all';

const WINDOW_IDS: readonly WindowId[] = ['today', 'last_7d', 'last_30d', 'all'];

/**
 * Days shown in the trend chart. `today` is a single day and the server
 * caps daily buckets at 100, so `all` cannot be charted truthfully — those
 * two windows show totals and breakdowns only.
 */
const CHART_DAYS: Partial<Record<WindowId, number>> = { last_7d: 7, last_30d: 30 };

/** Rows listed per breakdown before the remainder is rolled up. */
const BREAKDOWN_LIMIT = 6;
/** Small figures (stat cells, rows, axis ticks) abbreviate from ten thousand. */
const SMALL_COMPACT_FROM = 10_000;
/** Key the server uses for ledger rows without a model name. */
const UNKNOWN_MODEL_KEY = '(unknown)';
/** Expert avatar size in a breakdown row. */
const AVATAR = 28;

interface UsageData {
  window: WindowId;
  summary: UsageSummary;
  byAgent: UsageBucket[];
  byModel: UsageBucket[];
  agents: AgentSummary[];
}

type LoadError = 'unsupported' | 'failed';

function classifyError(error: unknown): LoadError {
  // A server that predates the usage ledger has no such route.
  return error instanceof OctopApiError && error.status === 404 ? 'unsupported' : 'failed';
}

/**
 * Token 统计 — the signed-in user's own token consumption: a headline total,
 * a daily trend, and where it went (by expert, by model). Opened from the
 * drawer; data comes from `GET /api/usage/summary`.
 */
export function UsageScreen() {
  const tokens = useTokens();
  const { t: strings } = useI18n();
  const { httpClient, user, ready } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [windowId, setWindowId] = useState<WindowId>('last_7d');
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [pending, setPending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // Only the newest request may write state: a slow reply for a window the
  // user has already left must not overwrite the one on screen.
  const requestSeq = useRef(0);

  // Every setState below runs after the awaits, never synchronously from
  // the effect that calls this (same shape as the automation screen's loader).
  const load = useCallback(
    (target: WindowId): Promise<void> => {
      requestSeq.current += 1;
      const seq = requestSeq.current;
      return (async () => {
        try {
          const api = new UsageApi(httpClient);
          const [summary, byAgent, byModel, agents] = await Promise.all([
            api.summary({ window: target, granularity: 'by_day' }),
            api.summary({ window: target, granularity: 'by_agent' }),
            api.summary({ window: target, granularity: 'by_model' }),
            // Avatars are decoration: the roster failing must not fail the screen.
            fetchAgents(httpClient).catch((): AgentSummary[] => []),
          ]);
          if (seq !== requestSeq.current) {
            return;
          }
          setData({
            window: target,
            summary,
            byAgent: byAgent.buckets,
            byModel: byModel.buckets,
            agents,
          });
          setError(null);
        } catch (cause) {
          if (seq !== requestSeq.current) {
            return;
          }
          setError(classifyError(cause));
        } finally {
          if (seq === requestSeq.current) {
            setPending(false);
            setRefreshing(false);
          }
        }
      })();
    },
    [httpClient],
  );

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    void load(windowId);
  }, [ready, user, windowId, load]);

  const changeWindow = (next: WindowId) => {
    setWindowId(next);
    setSelectedDay(null);
    setPending(true);
  };

  const retry = () => {
    setPending(true);
    void load(windowId);
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/chat');
    }
  };

  // Data for another window is only shown (dimmed) while its replacement is
  // on the way; once that request has failed, the error takes its place.
  const stale = data !== null && data.window !== windowId;
  const showError = error !== null && !pending && (data === null || stale);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader title={strings.usage.title} onBack={goBack} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.textTertiary}
              onRefresh={() => {
                setRefreshing(true);
                void load(windowId);
              }}
            />
          }
        >
          <SegmentedControl
            options={WINDOW_IDS.map(id => ({ id, label: strings.usage.windows[id] }))}
            value={windowId}
            onChange={changeWindow}
            accessibilityLabel={strings.usage.range}
          />

          {showError ? (
            <EmptyState
              icon={<CloudOff size={26} color={tokens.textTertiary} />}
              title={
                error === 'unsupported' ? strings.usage.unsupportedTitle : strings.usage.errorTitle
              }
              hint={
                error === 'unsupported' ? strings.usage.unsupportedHint : strings.usage.errorHint
              }
              action={{ label: strings.usage.retry, onPress: retry, testID: 'usage-retry' }}
            />
          ) : data === null ? (
            <SkeletonList rows={3} />
          ) : (
            <View style={[styles.sections, pending ? styles.dimmed : null]}>
              <SummaryCard summary={data.summary} />
              {data.summary.total_tokens === 0 && data.summary.turns === 0 ? (
                <EmptyState
                  inline
                  icon={<ChartNoAxesColumn size={26} color={tokens.textTertiary} />}
                  title={strings.usage.emptyTitle}
                  hint={strings.usage.emptyHint}
                />
              ) : (
                <>
                  {CHART_DAYS[data.window] !== undefined ? (
                    <DailyChartCard
                      summary={data.summary}
                      days={CHART_DAYS[data.window] ?? 7}
                      selected={selectedDay}
                      onSelect={setSelectedDay}
                    />
                  ) : null}
                  <Breakdown
                    title={strings.usage.byExpert}
                    buckets={data.byAgent}
                    agents={data.agents}
                    testID="usage-by-expert"
                  />
                  <Breakdown
                    title={strings.usage.byModel}
                    buckets={data.byModel.map(bucket =>
                      bucket.key === UNKNOWN_MODEL_KEY
                        ? { ...bucket, label: strings.usage.unknownModel }
                        : bucket,
                    )}
                    testID="usage-by-model"
                  />
                </>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Headline total with the four figures people check next. */
function SummaryCard({ summary }: { summary: UsageSummary }) {
  const tokens = useTokens();
  const { t: strings, locale } = useI18n();
  const total = usageCountDisplay(summary.total_tokens, locale);
  const small = (value: number) => formatCompactCount(value, locale, SMALL_COMPACT_FROM);
  // Compact formatting is pure; keep the callback identity stable across
  // renders so AnimatedCount does not restart mid-count.
  const formatTotal = useCallback((value: number) => formatCompactCount(value, locale), [locale]);

  const stats = [
    { label: strings.usage.input, value: small(summary.input_tokens) },
    { label: strings.usage.output, value: small(summary.output_tokens) },
    { label: strings.usage.cacheHit, value: `${Math.round(summary.cache_hit_percent)}%` },
    { label: strings.usage.turns, value: small(summary.turns) },
  ];

  return (
    <SettingsSection>
      <View
        accessible
        accessibilityLabel={`${strings.usage.total}, ${formatExactCount(summary.total_tokens)} ${strings.usage.unit}`}
        style={styles.totalBlock}
      >
        <Text style={[styles.totalCaption, { color: tokens.textTertiary }]}>
          {strings.usage.total}
        </Text>
        <View style={styles.totalLine}>
          <AnimatedCount
            testID="usage-total"
            value={summary.total_tokens}
            format={formatTotal}
            style={[styles.totalValue, { color: tokens.textPrimary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          <Text style={[styles.totalUnit, { color: tokens.textSecondary }]}>
            {strings.usage.unit}
          </Text>
        </View>
        {total.exact ? (
          <Text style={[styles.totalExact, { color: tokens.textTertiary }]}>{total.exact}</Text>
        ) : null}
      </View>
      <View style={[styles.statRow, { borderTopColor: tokens.borderSubtle }]}>
        {stats.map(stat => (
          <View
            key={stat.label}
            accessible
            accessibilityLabel={`${stat.label}, ${stat.value}`}
            style={styles.statCell}
          >
            <Text
              style={[styles.statValue, { color: tokens.textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: tokens.textTertiary }]} numberOfLines={1}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </SettingsSection>
  );
}

/** Daily trend: a headline that states the takeaway, then the bars. */
function DailyChartCard({
  summary,
  days,
  selected,
  onSelect,
}: {
  summary: UsageSummary;
  days: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  const tokens = useTokens();
  const { t: strings, locale } = useI18n();
  const reduceMotion = useReducedMotion();

  const series = dailySeries(summary.buckets, days, summary.range_end);
  if (series.length === 0) {
    return null;
  }
  const values = series.map(point => point.value);
  const sum = values.reduce((total, value) => total + value, 0);
  const average = Math.round(sum / series.length);
  const peakIndex = values.indexOf(Math.max(...values));
  const dayLabel = (index: number) => formatDayLabel(series[index].key, locale);
  const active = selected !== null && selected < series.length ? selected : null;
  const headline =
    active !== null
      ? strings.usage.dayValue(dayLabel(active), formatExactCount(values[active]))
      : strings.usage.dailyAverage(formatCompactCount(average, locale, SMALL_COMPACT_FROM));

  const first = dayLabel(0);
  const last = dayLabel(series.length - 1);
  const chartLabel =
    sum > 0
      ? strings.usage.chartSummary(
          first,
          last,
          formatExactCount(average),
          dayLabel(peakIndex),
          formatExactCount(values[peakIndex]),
        )
      : strings.usage.chartSummaryEmpty(first, last);

  return (
    <SettingsSection title={strings.usage.daily} footer={strings.usage.dailyNote}>
      <View style={styles.chartCard}>
        <Animated.Text
          key={headline}
          testID="usage-chart-headline"
          entering={reduceMotion ? undefined : FadeIn.duration(motion.state)}
          style={[styles.chartHeadline, { color: tokens.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {headline}
        </Animated.Text>
        <BarChart
          testID="usage-chart"
          values={values}
          axisLabels={series.map(point => formatDayShort(point.key))}
          formatTick={value => formatCompactCount(value, locale, SMALL_COMPACT_FROM)}
          selectedIndex={active}
          onSelect={onSelect}
          accessibilityLabel={chartLabel}
          describeBar={index =>
            strings.usage.barValue(dayLabel(index), formatExactCount(values[index]))
          }
        />
      </View>
    </SettingsSection>
  );
}

/** Ranked rows with proportional bars — where the tokens went. */
function Breakdown({
  title,
  buckets,
  agents,
  testID,
}: {
  title: string;
  buckets: UsageBucket[];
  /** When given, rows show the expert's avatar (matched by agent id). */
  agents?: AgentSummary[];
  testID?: string;
}) {
  const { t: strings } = useI18n();
  const { rows, rest } = rankBuckets(buckets, BREAKDOWN_LIMIT);
  if (rows.length === 0) {
    return null;
  }
  return (
    <SettingsSection title={title}>
      <View testID={testID}>
        {rows.map((row, index) => (
          <BreakdownRow
            key={row.key}
            row={row}
            agent={agents?.find(agent => agent.agent_id === row.key)}
            showAvatar={agents !== undefined}
            last={index === rows.length - 1 && rest === null}
          />
        ))}
        {rest ? (
          <BreakdownRow
            row={{ key: 'rest', label: strings.usage.others(rest.count), ...rest }}
            showAvatar={false}
            indent={agents !== undefined}
            last
          />
        ) : null}
      </View>
    </SettingsSection>
  );
}

function BreakdownRow({
  row,
  agent,
  showAvatar,
  indent = false,
  last,
}: {
  row: RankedRow;
  agent?: AgentSummary;
  showAvatar: boolean;
  /** Keeps a row without an avatar aligned with the rows that have one. */
  indent?: boolean;
  last: boolean;
}) {
  const tokens = useTokens();
  const { t: strings, locale } = useI18n();
  const share = formatShare(row.share);

  return (
    <View
      accessible
      accessibilityLabel={strings.usage.rowValue(row.label, formatExactCount(row.value), share)}
      style={styles.breakdownRow}
    >
      {showAvatar ? (
        <AgentAvatar
          name={row.label}
          iconName={agent?.icon_name}
          color={agent?.color}
          size={AVATAR}
          fallbackTextSecondary={tokens.textSecondary}
        />
      ) : indent ? (
        <View style={styles.avatarSpacer} />
      ) : null}
      <View
        style={[
          styles.breakdownBody,
          { borderBottomColor: tokens.borderSubtle },
          last ? styles.breakdownBodyLast : null,
        ]}
      >
        <View style={styles.breakdownLine}>
          <Text
            style={[styles.breakdownLabel, { color: tokens.textBody }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {row.label}
          </Text>
          <Text style={[styles.breakdownValue, { color: tokens.textPrimary }]}>
            {formatCompactCount(row.value, locale, SMALL_COMPACT_FROM)}
          </Text>
          <Text style={[styles.breakdownShare, { color: tokens.textTertiary }]}>{share}</Text>
        </View>
        <View style={[styles.track, { backgroundColor: tokens.overlaySubtle }]}>
          <View
            style={[
              styles.trackFill,
              { backgroundColor: tokens.accent, width: `${Math.max(1, row.relative * 100)}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 8,
    gap: 20,
  },
  sections: {
    gap: 24,
  },
  dimmed: {
    opacity: 0.5,
  },
  totalBlock: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 2,
  },
  totalCaption: {
    ...typeScale.footnote,
  },
  totalLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  totalValue: {
    ...typeScale.largeTitle,
    flexShrink: 1,
  },
  totalUnit: {
    ...typeScale.subheadline,
  },
  totalExact: {
    ...typeScale.footnote,
  },
  statRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  statValue: {
    ...typeScale.headline,
  },
  statLabel: {
    ...typeScale.caption1,
  },
  chartCard: {
    paddingLeft: layout.screenMargin,
    // The value labels already stand off the plot; no extra trailing margin.
    paddingRight: 4,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  chartHeadline: {
    ...typeScale.headline,
    marginRight: layout.screenMargin,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: layout.screenMargin,
  },
  avatarSpacer: {
    width: AVATAR,
  },
  breakdownBody: {
    flex: 1,
    minHeight: 56,
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingRight: layout.screenMargin,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  breakdownBodyLast: {
    borderBottomWidth: 0,
  },
  breakdownLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  breakdownLabel: {
    ...typeScale.body,
    flex: 1,
  },
  breakdownValue: {
    ...typeScale.subheadline,
    fontWeight: '600',
  },
  breakdownShare: {
    ...typeScale.footnote,
    minWidth: 36,
    textAlign: 'right',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
  },
});
