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
import { shouldOfferOnboarding } from '@/lib/onboarding'
import { parseLocalDate } from '@/lib/format'
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
  EarningsCard,
  TopBrandsCard,
  UpcomingPaymentsCard,
  type BrandStanding,
  type UpcomingPayment,
} from '@/components/home'
import {
  ActionGrid,
  Card,
  Chip,
  CountBadge,
  EmptyState,
  HeaderUtilities,
  ScreenHeader,
  SkeletonList,
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
 * The windows the brand ranking can be read over.
 *
 * Ordered shortest to longest, because `PeriodPill` advances through the list
 * on tap and a person guesses "wider" as the next step. Anything unordered
 * here makes the control feel random.
 */
const BRAND_PERIODS = ['This month', 'This year', 'All time'] as const

/**
 * Home.
 *
 * Three gradient cards answer the three questions a creator opens the app
 * with — what am I owed, what actually arrived, who is paying me — and
 * everything under them is the detail behind those answers.
 *
 * The cards are deliberately unlike each other: two saturated and one neutral,
 * one built on due dates, one on a six-month matrix, one on a ranking. Three
 * variations of the same card would look like a system and read like a wall.
 */
export default function HomeScreen() {
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
  const [brandPeriod, setBrandPeriod] = useState<string>(BRAND_PERIODS[1])

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

  /**
   * Brands ranked by what they have actually paid inside the chosen window.
   *
   * Keyed off `paid_date`, not the deal date: a brand that signed a large deal
   * in March and has not paid it has not earned a ranking, and a card titled
   * "Top brands" that ranks on promises is the same mistake as a revenue
   * figure built on invoices.
   */
  const brandStandings = useMemo<BrandStanding[]>(() => {
    const now = new Date()
    const totals = new Map<string, number>()

    for (const deal of deals) {
      for (const payment of paymentsInOrder(deal)) {
        const paidDate = payment.paid_date
        if (payment.status !== 'paid' || !paidDate) continue
        if (!withinPeriod(paidDate, brandPeriod, now)) continue

        const brandName = deal.brand?.name ?? 'Unknown brand'
        totals.set(
          brandName,
          (totals.get(brandName) ?? 0) + (payment.amount_received ?? payment.amount)
        )
      }
    }

    return [...totals.entries()]
      .map(([brandName, total]) => ({ id: brandName, name: brandName, total }))
      .sort((a, b) => b.total - a.total)
  }, [deals, brandPeriod])

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
        label: 'Year in review',
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

  const cards = (
    <View style={isDesktop ? styles.cardRow : styles.cardStack}>
      <View style={isDesktop ? styles.cardCell : undefined}>
        <UpcomingPaymentsCard
          payments={upcoming}
          onPress={() => router.push('/(app)/(tabs)/money' as never)}
        />
      </View>
      <View style={isDesktop ? styles.cardCell : undefined}>
        <EarningsCard
          received={sixMonths.total}
          count={sixMonths.count}
          monthly={revenue.monthlyTotals}
          onPress={() => router.push('/(app)/(tabs)/money' as never)}
        />
      </View>
      <View style={isDesktop ? styles.cardCell : undefined}>
        <TopBrandsCard
          brands={brandStandings}
          periods={BRAND_PERIODS}
          period={brandPeriod}
          onPeriodChange={setBrandPeriod}
          onPress={() => router.push('/(app)/(tabs)/brands' as never)}
        />
      </View>
    </View>
  )

  const needsYou = (
    <Card dense={isDesktop} style={styles.needsCard}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Needs you</Text>
          <Text style={[styles.cardSub, { color: c.textMuted }]}>
            {attention.length === 0
              ? 'Nothing is waiting on you'
              : `${attention.length} ${attention.length === 1 ? 'thing' : 'things'} to handle today`}
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
    </Card>
  )

  // Four across on desktop; two on a phone, where four would give each tile
  // about 90px.
  const actions = <ActionGrid actions={quickActions} columns={isDesktop ? 4 : 2} />

  const header = (
    <>
      <ScreenHeader
        // The list's own horizontal padding already insets this block; the
        // header's default padding would put the greeting 16px to the right of
        // every section under it.
        style={styles.headerFlush}
        eyebrow={todayLabel()}
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
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
        {cards}
      </ScreenHeader>

      <View style={styles.section}>{actions}</View>

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

      <View style={styles.section}>{needsYou}</View>

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
        data={visibleDeals}
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

/** Whether a `YYYY-MM-DD` falls inside one of `BRAND_PERIODS`. */
function withinPeriod(dateStr: string, period: string, now: Date): boolean {
  if (period === 'All time') return true
  const date = parseLocalDate(dateStr)
  if (period === 'This year') return date.getFullYear() === now.getFullYear()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
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

  // ── The card row ────────────────────────────────────────────────────
  cardStack: {
    gap: Spacing.md,
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
