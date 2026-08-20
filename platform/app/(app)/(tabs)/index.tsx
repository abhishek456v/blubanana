import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import Animated, { FadeIn } from 'react-native-reanimated'
import { getDeals, paymentsInOrder, type DealWithPaymentSummary } from '@/lib/deals'
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
import { useAuth } from '@/hooks/useAuth'
import { shouldOfferOnboarding } from '@/lib/onboarding'
import {
  daysFromToday,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  parseLocalDate,
} from '@/lib/format'
import type { DealStatus } from '@/types'
import { PLATFORM_LABELS, STATUS_LABELS } from '@/constants/labels'
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
import { BrandAvatar } from '@/components/BrandAvatar'
import { DealRow } from '@/components/DealRow'
import { StatusPill } from '@/components/StatusPill'
import type { UpcomingPayment } from '@/components/home'
import {
  ActionGrid,
  BarChart,
  Card,
  Chip,
  CountBadge,
  DataTable,
  type DataTableColumn,
  EmptyState,
  HeaderUtilities,
  HeroCard,
  ScreenHeader,
  SkeletonList,
  StatTile,
  useToast,
  ViewAllLink,
} from '@/components/ui'
import { SubscriptionBanner } from '@/components/SubscriptionBanner'
import { SyncBanner } from '@/components/SyncBanner'

type StatusFilter = DealStatus | 'all' | 'attention'

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Reminders' },
  ...(Object.keys(STATUS_LABELS) as DealStatus[]).map((key) => ({
    key: key as StatusFilter,
    label: STATUS_LABELS[key],
  })),
]

/**
 * Home.
 *
 * Two layouts, one screen (20 Aug redesign, Phase 2).
 *
 * On desktop: a metric strip of four figures, then one band carrying the
 * six-month chart, the next payment as the screen's single gradient card, and
 * Reminders; then the deals table. This replaced three 460px gradient cards
 * side by side, which filled the top half of a monitor with three numbers and
 * left two rows of data above the fold. Exactly one saturated surface per
 * screen is the rule the whole redesign turns on: the colour lands because
 * nothing else competes with it.
 *
 * On a phone: the same hero, then two compact tiles, Reminders, and the deal
 * list as the FlatList's own rows rather than a table, because a table
 * squeezed to 390px is worse than the rows it replaced. The phone previously
 * stacked three full-bleed gradient cards, so the first deal sat a screen and
 * a half down.
 *
 * Every list on the screen stops at six rows and offers "View all".
 */
export default function HomeScreen() {
  const { session } = useAuth()
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
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
        // cost the creator her deals. Hence the separate catch.
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
        // Silent when there is no session.
        //
        // Both screens sit under the signed in group, but the redirect to sign
        // in runs in an effect, so they mount and fetch for a frame or two
        // first. That fetch is refused, which is correct, and telling someone
        // who is being sent to a login screen that their deals failed to load
        // is not. It reached production as a red toast flashing over the sign
        // in page.
        if (session) toast('Could not load your deals', { tone: 'error' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast, session]
  )

  useFocusEffect(
    useCallback(() => {
      load('initial')
    }, [load])
  )

  // The onboarding gate lives here, not in a route guard: both auth redirects
  // land on this tab, so it is the one place every fresh sign-up passes.
  // Checked once per mount: an offer, not a wall.
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

  /** Unpaid, dated, soonest first. What the blue card is built from. */
  const upcoming = useMemo<UpcomingPayment[]>(
    () =>
      deals
        // One row per outstanding payment, not per deal: a deal on an advance
        // has two dates the creator needs to see, not one. Held deals are not
        // expected income (§8.6).
        .filter((deal) => !deal.on_hold)
        .flatMap((deal) =>
          paymentsInOrder(deal)
            .filter((payment) => payment.status !== 'paid' && payment.due_date)
            .map((payment) => ({ deal, payment }))
        )
        .sort((a, b) => a.payment.due_date!.localeCompare(b.payment.due_date!))
        .map(({ deal, payment }) => ({
          // Keyed by payment, not deal: a deal on an advance contributes two
          // rows and they must not collide.
          id: payment.id,
          brand: deal.brand?.name ?? 'Unknown brand',
          amount: payment.amount,
          dueDate: payment.due_date!,
        })),
    [deals]
  )


  /** Everything the six-month matrix covers, as one figure and one count. */
  const sixMonths = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const count = deals.filter((deal) => {
      return paymentsInOrder(deal).some(
        (payment) =>
          payment.status === 'paid' &&
          payment.paid_date &&
          parseLocalDate(payment.paid_date) >= cutoff
      )
    }).length

    return {
      total: revenue.monthlyTotals.reduce((sum, month) => sum + month.total, 0),
      count,
    }
  }, [deals, revenue.monthlyTotals])

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

  const quickActions = useMemo(
    () => [
      {
        icon: 'add-circle' as const,
        label: 'New deal',
        caption: 'Scan, speak or type',
        // The one thing a creator opens this app to do.
        primary: true,
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
        label: 'Year report',
        caption: 'Tax-ready summary',
        onPress: () => router.push('/(app)/annual-report' as never),
      },
    ],
    [router]
  )

  // ── Blocks ────────────────────────────────────────────────────────────
  // Each is a `const` rather than a component so the layout can place the same
  // block in a row on desktop and in the stack on mobile without remounting it
  // (and restarting its entrance animation) at the breakpoint.

  // The phone's opening block: one gradient hero and the two figures worth
  // checking beside it.
  //
  // This replaced three full-bleed gradient cards stacked vertically, which
  // between them filled a phone screen and a half, so a creator reached the
  // bottom of the viewport without seeing a single deal. Same rule as
  // desktop: one saturated surface, then quiet ones.
  const nextUp = upcoming[0]
  const heroNext = nextUp ? (
    <HeroCard
      label="Next payment"
      value={nextUp.amount}
      format={formatCurrency}
      caption={`${nextUp.brand} · ${dueWord(nextUp.dueDate)}`}
      stats={upcoming.slice(1, 3).map((payment) => ({
        label: `${payment.brand} · ${formatDate(payment.dueDate)}`,
        value: formatCurrency(payment.amount),
      }))}
      gradient="blue"
      onPress={() => router.push('/(app)/(tabs)/money' as never)}
      style={styles.fill}
    />
  ) : (
    <HeroCard
      label="Received this month"
      value={metrics.earnedThisMonth}
      format={formatCurrency}
      caption="Nothing due right now."
      gradient="blue"
      onPress={() => router.push('/(app)/(tabs)/money' as never)}
      style={styles.fill}
    />
  )

  const cards = (
    <View style={styles.cardStack}>
      {heroNext}
      <View style={styles.phoneTileRow}>
        <StatTile
          dense
          index={0}
          label="Still out"
          value={revenue.pending.value}
          format={formatCurrencyCompact}
          onPress={() => router.push('/(app)/(tabs)/money' as never)}
        />
        <StatTile
          dense
          index={1}
          label="Overdue"
          value={revenue.overdue.value}
          format={formatCurrencyCompact}
          tone={revenue.overdue.value > 0 ? 'danger' : 'default'}
          onPress={() => setFilter('attention')}
        />
      </View>
    </View>
  )

  // "Reminders", by name: the same word as the screen the View all opens and
  // the sidebar item that carries the badge, so the three are one thing.
  const reminders = (
    <Card dense={isDesktop} style={[styles.needsCard, isDesktop && styles.fill]}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Reminders</Text>
          <Text style={[styles.cardSub, { color: c.textMuted }]}>
            {attention.length === 0
              ? 'Nothing is waiting on you'
              : `${attention.length} to handle today`}
          </Text>
        </View>
        {attention.length > 0 ? <CountBadge count={attention.length} size={30} /> : null}
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

      {attention.length > 0 ? (
        <ViewAllLink onPress={() => router.push('/(app)/deals?filter=attention' as never)} />
      ) : null}
    </Card>
  )

  // Four across on desktop; two on a phone, where four would give each tile
  // about 90px.
  const actions = <ActionGrid actions={quickActions} columns={isDesktop ? 4 : 2} />

  // ── Desktop dashboard blocks (20 Aug redesign, Phase 2) ────────────────
  // One sentence of warmth under the bar, then density: four metric tiles,
  // one row of chart + hero + reminders, then the deals table. Exactly one
  // gradient on the screen.

  const greetingLine = (
    <Text style={[styles.greetingLine, { color: c.textSecondary }]}>
      {firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`}{' '}
      {attention.length === 0
        ? 'Nothing is late today.'
        : attention.length === 1
          ? 'One thing could use a look today.'
          : `${attention.length} things could use a look today.`}
    </Text>
  )

  const metricTiles = (
    <View style={styles.metricRow}>
      <StatTile
        dense
        index={0}
        label="Still out"
        value={revenue.pending.value}
        format={formatCurrency}
        caption={`across ${revenue.pending.count} unpaid ${revenue.pending.count === 1 ? 'deal' : 'deals'}`}
        onPress={() => router.push('/(app)/(tabs)/money' as never)}
      />
      <StatTile
        dense
        index={1}
        label="Received, six months"
        value={sixMonths.total}
        format={formatCurrency}
        caption={`${sixMonths.count} ${sixMonths.count === 1 ? 'deal' : 'deals'} paid`}
        onPress={() => router.push('/(app)/(tabs)/money' as never)}
      />
      <StatTile
        dense
        index={2}
        label="Overdue"
        value={revenue.overdue.value}
        format={formatCurrency}
        tone={revenue.overdue.value > 0 ? 'danger' : 'default'}
        caption={
          revenue.overdue.count === 0
            ? 'nothing is late'
            : `${revenue.overdue.count} ${revenue.overdue.count === 1 ? 'payment' : 'payments'} late`
        }
        onPress={() => setFilter('attention')}
      />
      {revenue.lockedThisMonth.value != null ? (
        <StatTile
          dense
          index={3}
          label="New this month"
          value={revenue.lockedThisMonth.value}
          format={formatCurrency}
          caption={`${revenue.lockedThisMonth.count} ${revenue.lockedThisMonth.count === 1 ? 'deal' : 'deals'} signed`}
        />
      ) : (
        // Rates are masked for this reader, so the signed total cannot show;
        // received money is theirs to see either way.
        <StatTile
          dense
          index={3}
          label="Received this month"
          value={metrics.earnedThisMonth}
          format={formatCurrency}
        />
      )}
    </View>
  )

  const chartCard = (
    <Card dense style={[styles.chartCard, styles.fill]}>
      <View style={styles.chartHead}>
        <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Money in</Text>
        <Text style={[styles.cardSub, { color: c.textMuted }]}>Last six months</Text>
        <View style={styles.spacer} />
        <Text style={[styles.chartTotal, { color: c.textPrimary }]}>
          {formatCurrency(sixMonths.total)}
        </Text>
      </View>
      <BarChart
        data={revenue.monthlyTotals.map((month) => ({ label: month.label, value: month.total }))}
        fill
        maxBarWidth={54}
        formatValue={formatCurrencyCompact}
        style={styles.chart}
      />
    </Card>
  )

  const dealColumns: DataTableColumn<DealWithPaymentSummary>[] = [
    {
      key: 'brand',
      title: 'Brand',
      flex: 2.1,
      render: (deal) => {
        const brandName = deal.brand?.name ?? 'Unknown brand'
        return (
          <View style={styles.brandCell}>
            <BrandAvatar name={brandName} size={26} />
            <Text style={[styles.brandName, { color: c.textPrimary }]} numberOfLines={1}>
              {brandName}
            </Text>
          </View>
        )
      },
    },
    {
      key: 'deliverable',
      title: 'Deliverable',
      flex: 1.7,
      render: (deal) => (
        <Text style={[styles.cellMuted, { color: c.textMuted }]} numberOfLines={1}>
          {PLATFORM_LABELS[deal.platform] ?? deal.platform} · {deal.deliverable_description}
        </Text>
      ),
    },
    {
      key: 'amount',
      title: 'Amount',
      flex: 1,
      align: 'right',
      render: (deal) => (
        <Text style={[styles.cellAmount, { color: c.textPrimary }]} numberOfLines={1}>
          {formatCurrency(deal.rate)}
        </Text>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      flex: 0.9,
      align: 'right',
      render: (deal) => <StatusPill status={deal.status} />,
    },
    {
      key: 'due',
      title: 'Due',
      flex: 0.7,
      align: 'right',
      render: (deal) => (
        <Text style={[styles.cellMuted, { color: c.textMuted }]} numberOfLines={1}>
          {nextDueLabel(deal)}
        </Text>
      ),
    },
  ]

  const filterChips = (
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
  )

  const dealsTable = (
    <Card dense style={styles.tableCard}>
      <View style={styles.tableHead}>
        <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Recent deals</Text>
        {visibleDeals.length > 0 ? <CountBadge count={visibleDeals.length} size={24} /> : null}
        <View style={styles.spacer} />
        {visibleDeals.length > 6 ? (
          <ViewAllLink
            label={`View all ${visibleDeals.length}`}
            onPress={() =>
              router.push(
                (filter === 'all' ? '/(app)/deals' : `/(app)/deals?filter=${filter}`) as never
              )
            }
          />
        ) : null}
      </View>
      {filterChips}
      {visibleDeals.length === 0 ? (
        <EmptyState
          icon={filter === 'all' ? 'sparkles' : 'funnel-outline'}
          title={filter === 'all' ? 'No deals yet' : 'Nothing here'}
          message={
            filter === 'all'
              ? 'Screenshot a brand DM, talk it out, or type it in. A deal takes about thirty seconds to log.'
              : 'Try another filter.'
          }
          actionLabel={filter === 'all' ? 'Add your first deal' : undefined}
          onAction={filter === 'all' ? () => router.push('/(app)/deal/new' as never) : undefined}
        />
      ) : (
        <DataTable
          columns={dealColumns}
          rows={visibleDeals.slice(0, 6)}
          keyOf={(deal) => deal.id}
          onRowPress={(deal) => router.push(`/(app)/deal/${deal.id}` as never)}
        />
      )}
    </Card>
  )

  const header = (
    <>
      {/* Above everything, because when the workspace is read-only every other
          control on this screen is already refusing to work. */}
      <SubscriptionBanner />
      <SyncBanner />
      <ScreenHeader
        // The list's own horizontal padding already insets this block; the
        // header's default padding would put the greeting 16px to the right of
        // every section under it.
        style={styles.headerFlush}
        // Desktop gets the page's name in the bar and the greeting as one
        // warm line under it; the phone keeps the greeting as its title.
        eyebrow={isDesktop ? undefined : todayLabel()}
        title={isDesktop ? 'Home' : firstName ? `${greeting()}, ${firstName}` : greeting()}
        compactTitle
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
        {isDesktop ? null : cards}
      </ScreenHeader>

      {isDesktop ? (
        <>
          <View style={styles.greetingSection}>{greetingLine}</View>
          <View style={styles.section}>{metricTiles}</View>
          <View style={[styles.section, styles.mainRow]}>
            <View style={styles.chartCell}>{chartCard}</View>
            <View style={styles.heroCell}>{heroNext}</View>
            <View style={styles.remindersCell}>{reminders}</View>
          </View>
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
          <View style={styles.section}>{dealsTable}</View>
        </>
      ) : (
        <>
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

          <View style={styles.section}>{reminders}</View>

          <View style={styles.section}>
            <SectionTitle
              title={filter === 'all' ? 'All deals' : FILTERS.find((f) => f.key === filter)!.label}
              count={visibleDeals.length}
            />
            {filterChips}
          </View>
        </>
      )}
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
      // Plain, not a raised card. These sit inside a card already, and a
      // filled row on a filled card is the boxes-inside-boxes pattern: the
      // containers become the thing you see and the four brand names stop
      // being it. The hairline and the alignment carry the list instead.
      <DealRow
        deal={item.deal}
        reason={item.reason}
        reasonColor={tone}
        index={index}
        dense={isDesktop}
        variant="plain"
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
        // On desktop the deals render as a table inside the header, so the
        // list itself carries nothing; on the phone it is the deal list.
        data={isDesktop ? [] : visibleDeals}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <DealRow
            deal={item}
            index={index}
            variant="plain"
            dense={isDesktop}
            onPress={() => router.push(`/(app)/deal/${item.id}` as never)}
          />
        )}
        ListHeaderComponent={header}
        // Phone only, and under the deals rather than over them: the quick
        // actions used to cost two rows between the figures and the first
        // deal, on the one screen where a creator is looking for a deal. Their
        // primary item, New deal, is the header button now.
        ListFooterComponent={
          isDesktop ? null : <View style={styles.footerActions}>{actions}</View>
        }
        ListEmptyComponent={
          isDesktop ? null : (
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
          )
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

/**
 * "was due 3 Aug" / "due 16 Aug" / "due today".
 *
 * The hero card's caption carries the one payment a creator most needs to act
 * on, and whether it is late is the difference between reading it and chasing
 * it. A bare date leaves that to be worked out.
 */
function dueWord(dateStr: string): string {
  const days = daysFromToday(dateStr)
  if (days === 0) return 'due today'
  return days < 0 ? `was due ${formatDate(dateStr)}` : `due ${formatDate(dateStr)}`
}

/** The next unpaid payment's due date, for the table's Due column. */
function nextDueLabel(deal: DealWithPaymentSummary): string {
  const next = paymentsInOrder(deal).find(
    (payment) => payment.status !== 'paid' && payment.due_date
  )
  if (next?.due_date) return formatDate(next.due_date)
  return deal.status === 'paid' ? 'Paid' : '—'
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  // A dashboard is not prose, so the reading-length cap that suits a form is
  // wrong here. It left a 720px column stranded in the middle of a 1440px
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

  // ── The desktop dashboard (20 Aug redesign, Phase 2) ─────────────────
  greetingSection: {
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  greetingLine: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  metricRow: {
    flexDirection: 'row',
    gap: ColumnGap,
  },
  // The three-cell row: chart, hero, reminders. Stretched so all three end on
  // the same line, which is what makes it read as one band rather than three
  // cards that happen to be adjacent.
  mainRow: {
    flexDirection: 'row',
    gap: ColumnGap,
    alignItems: 'stretch',
  },
  chartCell: {
    flex: 1.9,
  },
  heroCell: {
    flex: 1.25,
  },
  remindersCell: {
    flex: 1.15,
  },
  fill: {
    flex: 1,
  },
  chartCard: {
    gap: Spacing.base,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  chartTotal: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  chart: {
    flex: 1,
    minHeight: 132,
  },
  spacer: {
    flex: 1,
  },
  tableCard: {
    gap: Spacing.base,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 0,
  },
  brandName: {
    ...Typography.body,
    fontFamily: FontFamily.semiBold,
    flexShrink: 1,
  },
  cellMuted: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  cellAmount: {
    ...Typography.body,
    fontFamily: FontFamily.semiBold,
    fontVariant: ['tabular-nums'],
  },

  // ── The card row ────────────────────────────────────────────────────
  cardStack: {
    gap: Spacing.md,
  },
  phoneTileRow: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  footerActions: {
    marginTop: Spacing.lg,
  },
  cardRow: {
    flexDirection: 'row',
    gap: ColumnGap,
    // Equal heights here, unlike the rest of the app's rows. Nothing inside
    // these cards flexes (the ring and the dot matrix are both fixed), so
    // stretching squares off the row without letting one card's content be
    // sized by its neighbour's.
    alignItems: 'stretch',
  },
  cardCell: {
    flex: 1,
  },

  // Must *not* flex to fill its column: the deal list sits under it, and a
  // stretched attention card would push the list off the fold.
  needsCard: {
    padding: Spacing.md,
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
    gap: Spacing.xxs,
  },
  cardTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.display,
  },
  cardSub: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
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
    gap: Spacing.base,
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
    paddingHorizontal: Spacing.sm,
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
    paddingBottom: Spacing.xxs,
  },
  list: {
    gap: Spacing.sm,
  },
})
