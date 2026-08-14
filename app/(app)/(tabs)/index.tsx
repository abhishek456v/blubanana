import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import Animated, { FadeIn } from 'react-native-reanimated'
import { getDeals, type DealWithPaymentSummary } from '@/lib/deals'
import { describeNudge, getRateBenchmarkNudge } from '@/lib/rateBenchmark'
import { getStatHistory, type StatSnapshot } from '@/lib/social'
import { computeRevenueSummary } from '@/lib/revenue'
import {
  getAttentionItems,
  getHomeMetrics,
  greeting,
  todayLabel,
  type AttentionItem,
} from '@/lib/insights'
import { getProfile } from '@/lib/profile'
import { shouldOfferOnboarding } from '@/lib/onboarding'
import { formatCurrency, formatCurrencyCompact } from '@/lib/format'
import type { DealStatus } from '@/types'
import { STATUS_LABELS } from '@/constants/labels'
import {
  ColumnGap,
  DesktopContentMaxWidth,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useTheme } from '@/hooks/useTheme'
import { DealRow } from '@/components/DealRow'
import {
  ActionGrid,
  BarChart,
  Card,
  Chip,
  DonutChart,
  EmptyState,
  HeaderUtilities,
  HeroCard,
  ScreenHeader,
  SkeletonList,
  StatTile,
  useToast,
} from '@/components/ui'

type StatusFilter = DealStatus | 'all' | 'attention'

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs you' },
  ...(Object.keys(STATUS_LABELS) as DealStatus[]).map((key) => ({
    key: key as StatusFilter,
    label: STATUS_LABELS[key],
  })),
]

/**
 * Home.
 *
 * Laid out as a bento rather than a single stack: on desktop the hero, the
 * supporting tiles, the cash-flow chart and the attention list sit side by
 * side, so the first screenful answers "what am I owed, how is the year
 * going, what needs me today" without a scroll. Below `desktop` the same
 * blocks stack in that order of importance.
 *
 * The previous version was a metric strip plus two lists, which used about
 * half the height of a laptop window and left the rest empty.
 */
export default function HomeScreen() {
  const { c } = useTheme()
  const { isWide, isDesktop } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()

  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [name, setName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [reach, setReach] = useState<StatSnapshot[]>([])

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true)
      try {
        // The profile only supplies the greeting, so a failure there must not
        // cost the creator her deals — hence the separate catch.
        const [dealData] = await Promise.all([
          getDeals(),
          // Real reach makes the rate nudge able to talk about engagement, not
          // just follower count. Absent a connected account it stays empty and
          // the nudge falls back to the manual snapshot.
          getStatHistory('instagram', 365)
            .then(setReach)
            .catch(() => {}),
          getProfile()
            .then((profile) => setName(profile.name || null))
            .catch(() => {}),
        ])
        setDeals(dealData)
      } catch {
        toast('Could not load your deals', { tone: 'error' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast]
  )

  useFocusEffect(
    useCallback(() => {
      load('initial')
    }, [load])
  )

  // The onboarding gate lives here, not in a route guard: both auth redirects
  // land on this tab, so it is the one place every fresh sign-up passes.
  // Checked once per mount — an offer, not a wall.
  useEffect(() => {
    let active = true
    shouldOfferOnboarding().then((offer) => {
      if (active && offer) router.replace('/(app)/onboarding' as never)
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const metrics = useMemo(() => getHomeMetrics(deals), [deals])
  const revenue = useMemo(() => computeRevenueSummary(deals), [deals])
  const attention = useMemo(() => getAttentionItems(deals), [deals])
  const rateNudge = useMemo(() => getRateBenchmarkNudge(deals, reach), [deals, reach])

  const attentionIds = useMemo(
    () => new Set(attention.map((item) => item.deal.id)),
    [attention]
  )

  const visibleDeals = useMemo(() => {
    if (filter === 'all') return deals
    if (filter === 'attention') return deals.filter((deal) => attentionIds.has(deal.id))
    return deals.filter((deal) => deal.status === filter)
  }, [deals, filter, attentionIds])

  const firstName = name?.trim().split(/\s+/)[0]

  const onTrack = Math.max(metrics.outstanding - metrics.overdue, 0)
  const unpaidCount = revenue.pending.count

  const quickActions = useMemo(
    () => [
      {
        icon: 'add-circle' as const,
        label: 'New deal',
        caption: 'Scan, speak or type',
        onPress: () => router.push('/(app)/deal/new' as never),
      },
      {
        icon: 'document-text' as const,
        label: 'Raise invoice',
        caption: 'GST ready',
        onPress: () => router.push('/(app)/invoice/new' as never),
      },
      {
        icon: 'people' as const,
        label: 'Add brand',
        caption: 'Save a contact',
        onPress: () => router.push('/(app)/brand/new' as never),
      },
      {
        icon: 'bar-chart' as const,
        label: 'Year in review',
        caption: 'Tax-ready summary',
        onPress: () => router.push('/(app)/annual-report' as never),
      },
    ],
    [router]
  )

  // ── Blocks ────────────────────────────────────────────────────────────
  // Each is a `const` rather than a component so the bento can place the same
  // block in a column on desktop and in the stack on mobile without
  // remounting it (and restarting its entrance animation) at the breakpoint.

  const hero = (
    <HeroCard
      label="Owed to you"
      value={metrics.outstanding}
      format={formatCurrency}
      caption={
        unpaidCount === 0
          ? 'Nothing outstanding. Every deal is settled.'
          : metrics.overdue > 0
            ? `${formatCurrencyCompact(metrics.overdue)} of it is already past due.`
            : `Across ${unpaidCount} unpaid ${unpaidCount === 1 ? 'deal' : 'deals'}, all on track.`
      }
      action={{ label: 'Money', onPress: () => router.push('/(app)/(tabs)/money' as never) }}
      // Doubles as the donut's legend — same two colours, same two figures —
      // so the ring never needs a separate key beside it.
      stats={[
        { label: 'On track', value: formatCurrencyCompact(onTrack), dotColor: c.accent },
        { label: 'Overdue', value: formatCurrencyCompact(metrics.overdue), dotColor: c.danger },
        {
          label: unpaidCount === 1 ? 'Unpaid deal' : 'Unpaid deals',
          value: String(unpaidCount),
        },
      ]}
      aside={
        isWide && metrics.outstanding > 0 ? (
          <DonutChart
            segments={[
              { label: 'On track', value: onTrack, color: c.accent },
              { label: 'Overdue', value: metrics.overdue, color: c.danger },
            ]}
            size={108}
            strokeWidth={11}
            trackColor={c.onContrastFaint}
            textColor={c.onContrast}
            mutedTextColor={c.onContrastMuted}
            centerLabel={formatCurrencyCompact(metrics.outstanding)}
            centerCaption="owed"
          />
        ) : null
      }
    />
  )

  const sideTiles = (
    <View style={isDesktop ? styles.tileColumn : styles.tileRow}>
      <StatTile
        label="Received this month"
        value={metrics.earnedThisMonth}
        format={formatCurrency}
        tone="success"
        caption={`${revenue.earnedThisMonth.count} ${revenue.earnedThisMonth.count === 1 ? 'payment' : 'payments'} in`}
        onPress={() => router.push('/(app)/(tabs)/money' as never)}
        index={1}
      />
      <StatTile
        label="Locked this month"
        value={revenue.lockedThisMonth.value}
        format={formatCurrency}
        caption={`${revenue.lockedThisMonth.count} new ${revenue.lockedThisMonth.count === 1 ? 'deal' : 'deals'} signed`}
        onPress={() => router.push('/(app)/(tabs)/money' as never)}
        index={2}
      />
      <StatTile
        label="Live deals"
        value={metrics.activeDeals}
        caption={metrics.activeDeals === 0 ? 'nothing in flight' : 'in progress right now'}
        onPress={() => router.push('/(app)/(tabs)/work' as never)}
        index={3}
      />
    </View>
  )

  const cashFlow = (
    <Card style={styles.blockCard}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Cash flow</Text>
          <Text style={[styles.cardSub, { color: c.textMuted }]}>
            Payments received, last six months
          </Text>
        </View>
        <Text style={[styles.cardFigure, { color: c.textPrimary }]}>
          {formatCurrencyCompact(
            revenue.monthlyTotals.reduce((sum, month) => sum + month.total, 0)
          )}
        </Text>
      </View>
      <BarChart
        data={revenue.monthlyTotals.map((month) => ({
          label: month.label,
          value: month.total,
        }))}
        height={120}
        fill={isDesktop}
        formatValue={formatCurrencyCompact}
      />
    </Card>
  )

  const needsYou = (
    <Card style={styles.needsCard}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Needs you</Text>
          <Text style={[styles.cardSub, { color: c.textMuted }]}>
            {attention.length === 0
              ? 'Nothing is waiting on you'
              : `${attention.length} ${attention.length === 1 ? 'thing' : 'things'} to handle today`}
          </Text>
        </View>
        {attention.length > 0 ? (
          <View style={[styles.countBadge, { backgroundColor: c.dangerLight }]}>
            <Text style={[styles.countText, { color: c.danger }]}>{attention.length}</Text>
          </View>
        ) : null}
      </View>

      {attention.length === 0 ? (
        <View style={styles.clearState}>
          <Text style={[styles.clearTitle, { color: c.textSecondary }]}>All clear</Text>
          <Text style={[styles.clearBody, { color: c.textMuted }]}>
            No overdue payments, no missed deadlines.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {attention.slice(0, isDesktop ? 4 : 3).map((item, index) => (
            <AttentionRow key={item.deal.id} item={item} index={index} />
          ))}
        </View>
      )}
    </Card>
  )

  // Two columns even on desktop: these now live in the narrower right-hand
  // column, where four across would give each tile 90px.
  const actions = <ActionGrid actions={quickActions} columns={2} />

  const header = (
    <>
      <ScreenHeader
        // The list's own horizontal padding already insets this block; the
        // header's default padding would put the greeting 16px to the right of
        // every section under it.
        style={styles.headerFlush}
        eyebrow={todayLabel()}
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        actions={[
          {
            icon: 'add',
            label: 'Add deal',
            primary: true,
            onPress: () => router.push('/(app)/deal/new' as never),
          },
        ]}
        leadingAction={<HeaderUtilities />}
      >
        {/* Row A — the answer, then the two numbers that qualify it. */}
        <View style={isDesktop ? styles.rowA : styles.stack}>
          <View style={isDesktop ? styles.heroCell : undefined}>{hero}</View>
          <View style={isDesktop ? styles.asideCell : undefined}>{sideTiles}</View>
        </View>
      </ScreenHeader>

      {rateNudge && !nudgeDismissed ? (
        <Animated.View entering={FadeIn.duration(Duration.slow)} style={styles.section}>
          <Chip
            label={describeNudge(rateNudge)}
            icon="trending-up"
            selected
            onPress={() => setNudgeDismissed(true)}
          />
        </Animated.View>
      ) : null}

      {/* Row B — the trend beside the to-do list, with the quick actions
          filling the rest of the right column. Without them the attention
          card stretched to the chart's height and carried 150px of nothing. */}
      <View style={[styles.section, isDesktop ? styles.rowB : styles.stack]}>
        <View style={isDesktop ? styles.chartCell : undefined}>{cashFlow}</View>
        <View style={isDesktop ? styles.attentionCell : styles.stack}>
          {needsYou}
          {actions}
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle
          title={filter === 'all' ? 'All deals' : FILTERS.find((f) => f.key === filter)!.label}
          count={visibleDeals.length}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              selected={filter === option.key}
              onPress={() => setFilter(option.key)}
            />
          ))}
        </ScrollView>
      </View>
    </>
  )

  function SectionTitle({ title, count }: { title: string; count?: number }) {
    return (
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>{title}</Text>
        {count != null && count > 0 ? (
          <View style={[styles.countBadge, { backgroundColor: c.bgSurface }]}>
            <Text style={[styles.countText, { color: c.textSecondary }]}>{count}</Text>
          </View>
        ) : null}
      </View>
    )
  }

  function AttentionRow({ item, index }: { item: AttentionItem; index: number }) {
    const tone =
      item.tone === 'danger' ? c.danger : item.tone === 'warning' ? c.warning : c.info
    return (
      <DealRow
        deal={item.deal}
        reason={item.reason}
        reasonColor={tone}
        index={index}
        surface="raised"
        onPress={() => router.push(`/(app)/deal/${item.deal.id}` as never)}
      />
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader eyebrow={todayLabel()} title={greeting()} />
          <View style={[styles.section, styles.listContent]}>
            <SkeletonList count={5} />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
      <FlatList
        data={visibleDeals}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <DealRow
            deal={item}
            index={index}
            onPress={() => router.push(`/(app)/deal/${item.id}` as never)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon={filter === 'all' ? 'sparkles' : 'funnel-outline'}
            title={filter === 'all' ? 'No deals yet' : 'Nothing here'}
            message={
              filter === 'all'
                ? 'Screenshot a brand DM, talk it out, or type it in. A deal takes about thirty seconds to log.'
                : 'Try another filter.'
            }
            actionLabel={filter === 'all' ? 'Add your first deal' : undefined}
            onAction={
              filter === 'all' ? () => router.push('/(app)/deal/new' as never) : undefined
            }
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={c.textMuted}
            colors={[c.accent]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  // A dashboard is not prose, so the reading-length cap that suits a form is
  // wrong here — it left a 720px column stranded in the middle of a 1440px
  // window.
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },

  headerFlush: {
    paddingHorizontal: 0,
  },

  // ── Bento ───────────────────────────────────────────────────────────
  // Weights, not fixed widths: the hero gets roughly three-fifths of row A
  // because a 40px figure needs the room, and the chart gets more of row B
  // than the list because six bars compress badly.
  stack: {
    gap: 10,
  },
  rowA: {
    flexDirection: 'row',
    gap: ColumnGap,
    alignItems: 'stretch',
  },
  heroCell: {
    flex: 1.55,
  },
  asideCell: {
    flex: 1,
  },
  rowB: {
    flexDirection: 'row',
    gap: ColumnGap,
    alignItems: 'stretch',
  },
  chartCell: {
    flex: 1.35,
  },
  attentionCell: {
    flex: 1,
    gap: ColumnGap,
  },
  tileColumn: {
    flex: 1,
    gap: ColumnGap,
  },
  // Wraps, because three tiles at their 148px minimum plus gaps is 464px and a
  // phone gives 358 — without this the third tile ran off the right edge.
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  blockCard: {
    flex: 1,
    padding: Spacing.md + 2,
    gap: Spacing.md,
  },
  // Unlike the chart card this one must *not* flex to fill its column — the
  // quick actions sit under it, and a stretched attention card would push
  // them off the fold.
  needsCard: {
    padding: Spacing.md + 2,
    gap: Spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardHeadText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.display,
  },
  cardSub: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  cardFigure: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
  },
  clearState: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: 3,
  },
  clearTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  clearBody: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },

  section: {
    marginBottom: Spacing.md,
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
  filterRow: {
    gap: Spacing.sm,
    paddingBottom: 2,
  },
  list: {
    gap: Spacing.sm,
  },
  separator: {
    height: 10,
  },
})
