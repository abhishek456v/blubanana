import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import { getDeals, type DealWithPaymentSummary } from '@/lib/deals'
import { getDeliverablesForDeals } from '@/lib/deliverables'
import {
  buildArchive,
  buildPerformance,
  formatCount,
  formatRate,
  type DeliverablePerformance,
} from '@/lib/performance'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/format'
import type { Deliverable } from '@/types'
import { DELIVERABLE_LABELS } from '@/constants/labels'
import {
  ColumnGap,
  DesktopContentMaxWidth,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useTheme } from '@/hooks/useTheme'
import { BrandAvatar } from '@/components/BrandAvatar'
import { DealRow } from '@/components/DealRow'
import {
  Card,
  EmptyState,
  HeaderUtilities,
  HeroCard,
  ProgressRing,
  Reveal,
  RevealScrollView,
  ScreenHeader,
  SegmentedControl,
  SkeletonList,
  StatTile,
  useToast,
} from '@/components/ui'

type WorkView = 'archive' | 'performance'

const VIEWS = [
  { key: 'archive' as const, label: 'Archive' },
  { key: 'performance' as const, label: 'Performance' },
]

/**
 * Work — the creator's own record of everything she has shipped.
 *
 * Two questions, one destination. *Archive* is "what have I made", a
 * year-by-year back catalogue that doubles as the single place to find an old
 * deal. *Performance* is "what worked", so the next brief can be shaped like
 * the things that landed rather than guessed at.
 *
 * Home stays about today; this is about the body of work behind it.
 */
export default function WorkScreen() {
  const { c } = useTheme()
  const { isWide, isDesktop } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()

  const [view, setView] = useState<WorkView>('archive')
  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [deliverables, setDeliverables] = useState<Map<string, Deliverable[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true)
      try {
        const dealData = await getDeals()
        setDeals(dealData)
        setDeliverables(await getDeliverablesForDeals(dealData.map((deal) => deal.id)))
      } catch {
        toast('Could not load your work', { tone: 'error' })
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

  const archive = useMemo(() => buildArchive(deals), [deals])
  const performance = useMemo(
    () => buildPerformance(deals, deliverables),
    [deals, deliverables]
  )

  const lifetimeEarned = useMemo(
    () => archive.reduce((total, year) => total + year.totalEarned, 0),
    [archive]
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
      <RevealScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={c.textMuted}
            colors={[c.accent]}
          />
        }
      >
        <ScreenHeader
          style={styles.headerFlush}
          title="Work"
          subtitle={
            view === 'archive'
              ? 'Everything you have shipped, in one place.'
              : 'How your posts actually performed.'
          }
          leadingAction={<HeaderUtilities />}
          actions={[
            {
              icon: 'add',
              label: 'Add deal',
              primary: true,
              onPress: () => router.push('/(app)/deal/new' as never),
            },
          ]}
        >
          <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        </ScreenHeader>

        {loading ? (
          <View style={styles.section}>
            <SkeletonList count={4} />
          </View>
        ) : view === 'archive' ? (
          <ArchiveView />
        ) : (
          <PerformanceView />
        )}
      </RevealScrollView>
    </SafeAreaView>
  )

  function ArchiveView() {
    if (deals.length === 0) {
      return (
        <EmptyState
          icon="albums-outline"
          title="Nothing here yet"
          message="Every deal you log shows up here, grouped by year. Your whole body of work in one place."
          actionLabel="Add a deal"
          onAction={() => router.push('/(app)/deal/new' as never)}
        />
      )
    }

    const brandCount = new Set(deals.map((deal) => deal.brand_id)).size
    const bestYear = archive.reduce(
      (best, year) => (best && best.totalEarned >= year.totalEarned ? best : year),
      archive[0]
    )

    return (
      <View style={styles.section}>
        <View style={isDesktop ? styles.rowA : styles.stack}>
          <View style={isDesktop ? styles.heroCell : undefined}>
            <HeroCard
              label="Lifetime earned"
              value={lifetimeEarned}
              format={formatCurrency}
              caption={`Across ${deals.length} ${deals.length === 1 ? 'deal' : 'deals'} with ${brandCount} ${brandCount === 1 ? 'brand' : 'brands'}, since you started logging.`}
              stats={[
                { label: 'Deals', value: String(deals.length) },
                { label: 'Brands', value: String(brandCount) },
                {
                  label: 'Best year',
                  value: bestYear ? `${bestYear.year}` : '—',
                },
              ]}
            />
          </View>
          <View style={isDesktop ? styles.asideCell : undefined}>
            <View style={isDesktop ? styles.tileColumn : styles.tileRow}>
              <StatTile
                label="Years active"
                value={archive.length}
                caption={archive.length === 1 ? 'first year in' : 'of logged work'}
                index={1}
              />
              <StatTile
                label="Brands"
                value={brandCount}
                caption="worked with"
                onPress={() => router.push('/(app)/(tabs)/brands' as never)}
                index={2}
              />
            </View>
          </View>
        </View>

        {archive.map((year) => (
          <Reveal key={year.year} style={styles.yearBlock}>
            <View style={styles.yearHeader}>
              <Text style={[styles.yearTitle, { color: c.textPrimary }]}>{year.year}</Text>
              <Text style={[styles.yearMeta, { color: c.textSecondary }]}>
                {year.dealCount} {year.dealCount === 1 ? 'deal' : 'deals'} ·{' '}
                {formatCurrencyCompact(year.totalEarned)}
              </Text>
            </View>

            <View style={isDesktop ? styles.listGrid : styles.list}>
              {year.deals.map((deal, index) => (
                <View key={deal.id} style={isDesktop ? styles.listGridCell : undefined}>
                  <DealRow
                    deal={deal}
                    index={index}
                    stretch={isDesktop}
                    variant={isDesktop ? 'card' : 'plain'}
                    onPress={() => router.push(`/(app)/deal/${deal.id}` as never)}
                  />
                </View>
              ))}
            </View>
          </Reveal>
        ))}
      </View>
    )
  }

  function PerformanceView() {
    if (performance.items.length === 0) {
      return (
        <EmptyState
          icon="stats-chart-outline"
          title="No numbers yet"
          message={
            performance.missingCount > 0
              ? `You have ${performance.missingCount} published ${performance.missingCount === 1 ? 'post' : 'posts'} with no stats. Open a deal and add its views and likes to see how it did.`
              : 'Once a post goes live and you add its views and likes, this is where you will see what worked.'
          }
        />
      )
    }

    return (
      <View style={styles.section}>
        <HeroCard
          label="Total views"
          value={performance.totalViews}
          format={formatCount}
          caption={`Across ${performance.items.length} tracked ${performance.items.length === 1 ? 'post' : 'posts'}, averaging ${formatRate(performance.avgEngagementRate)} engagement.`}
          stats={[
            { label: 'Engagements', value: formatCount(performance.totalEngagements) },
            { label: 'Posts tracked', value: String(performance.items.length) },
            {
              label: 'Best format',
              value: performance.byKind.length
                ? DELIVERABLE_LABELS[performance.byKind[0].kind]
                : '—',
            },
          ]}
          aside={
            isWide ? (
              <ProgressRing
                // 10% engagement is a strong rate on Indian short-form, so it
                // makes a fair full-ring benchmark rather than an unreachable
                // 100%.
                progress={(performance.avgEngagementRate ?? 0) / 0.1}
                size={108}
                strokeWidth={11}
                label={formatRate(performance.avgEngagementRate)}
                caption="avg"
                labelColor={c.onContrast}
                captionColor={c.onContrastMuted}
                trackColor={c.onContrastFaint}
              />
            ) : null
          }
        />

        {performance.byKind.length > 1 ? (
          <Card>
            <Text style={[styles.cardTitle, { color: c.textPrimary }]}>What works best</Text>
            <Text style={[styles.cardHint, { color: c.textSecondary }]}>
              Your strongest format is {DELIVERABLE_LABELS[performance.byKind[0].kind]} at{' '}
              {formatRate(performance.byKind[0].avgEngagementRate)} engagement.
            </Text>

            <View style={styles.kindList}>
              {performance.byKind.map((kind) => (
                <View key={kind.kind} style={styles.kindRow}>
                  <Text style={[styles.kindName, { color: c.textPrimary }]}>
                    {DELIVERABLE_LABELS[kind.kind]}
                  </Text>
                  <Text style={[styles.kindMeta, { color: c.textMuted }]}>
                    {kind.count} · {formatCount(kind.avgViews)} views
                  </Text>
                  <Text style={[styles.kindRate, { color: c.accentText }]}>
                    {formatRate(kind.avgEngagementRate)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Every post</Text>
        <View style={styles.list}>
          {performance.items.map((item) => (
            <PerformanceRow key={item.deliverable.id} item={item} />
          ))}
        </View>

        {performance.missingCount > 0 ? (
          <Text style={[styles.footnote, { color: c.textMuted }]}>
            {performance.missingCount} published{' '}
            {performance.missingCount === 1 ? 'post has' : 'posts have'} no stats yet. Open the
            deal to add them.
          </Text>
        ) : null}
      </View>
    )
  }

  function PerformanceRow({ item }: { item: DeliverablePerformance }) {
    const brandName = item.deal.brand?.name ?? 'Unknown brand'
    const isBest = performance.best?.deliverable.id === item.deliverable.id

    return (
      <Card
        variant="surface"
        onPress={() => router.push(`/(app)/deal/${item.deal.id}` as never)}
        style={styles.perfRow}
      >
        <BrandAvatar name={brandName} size={38} />

        <View style={styles.perfCenter}>
          <View style={styles.perfTitleRow}>
            <Text style={[styles.perfBrand, { color: c.textPrimary }]} numberOfLines={1}>
              {brandName}
            </Text>
            {isBest ? (
              <View style={[styles.bestBadge, { backgroundColor: c.accentLight }]}>
                <Ionicons name="trophy" size={10} color={c.accent} />
                <Text style={[styles.bestText, { color: c.accentText }]}>Best</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.perfMeta, { color: c.textSecondary }]} numberOfLines={1}>
            {DELIVERABLE_LABELS[item.deliverable.kind]}
            {item.deliverable.published_at ? ` · ${formatDate(item.deliverable.published_at)}` : ''}
          </Text>

          <Text style={[styles.perfMeta, { color: c.textMuted }]} numberOfLines={1}>
            {formatCount(item.views)} views · {formatCount(item.engagements)} engagements
            {item.costPerMille != null ? ` · ${formatCurrency(item.costPerMille)}/1K` : ''}
          </Text>
        </View>

        <Text style={[styles.perfRate, { color: c.accentText }]}>
          {formatRate(item.engagementRate)}
        </Text>
      </Card>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerFlush: {
    paddingHorizontal: 0,
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
  tileColumn: {
    flex: 1,
    gap: ColumnGap,
  },
  stack: {
    gap: Spacing.base,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
  },
  // Two per row on desktop: a single column of 1160px-wide rows carrying a
  // brand name and a figure is the stretched-phone layout DESIGN.md §4 rules
  // out.
  listGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
  },
  listGridCell: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  section: {
    gap: Spacing.md,
  },
  list: {
    gap: Spacing.base,
  },
  yearBlock: {
    gap: Spacing.sm,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  yearTitle: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  yearMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  sectionTitle: {
    ...Typography.title,
    fontFamily: FontFamily.display,
    marginTop: Spacing.sm,
  },
  cardTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  cardHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 19,
    marginTop: Spacing.xxs,
  },
  kindList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  kindName: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  kindMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  kindRate: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
    minWidth: 52,
    textAlign: 'right',
  },
  perfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  perfCenter: {
    flex: 1,
    gap: Spacing.xxs,
  },
  perfTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  perfBrand: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
    flexShrink: 1,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.full,
  },
  bestText: {
    ...Typography.label,
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
  },
  perfMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  perfRate: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  footnote: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 19,
    marginTop: Spacing.sm,
  },
})
