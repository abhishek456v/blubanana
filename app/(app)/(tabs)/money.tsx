import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import { getDeals, type DealWithPaymentSummary } from '@/lib/deals'
import { computeRevenueSummary } from '@/lib/revenue'
import { getInvoices } from '@/lib/invoices'
import { formatCurrency, formatCurrencyCompact } from '@/lib/format'
import type { Invoice } from '@/types'
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
import {
  BarChart,
  Card,
  DonutChart,
  HeaderUtilities,
  HeroCard,
  ListRow,
  ScreenHeader,
  Skeleton,
  StatTile,
  useToast,
} from '@/components/ui'

/**
 * Money.
 *
 * Leads with what was *locked* this month rather than what was received.
 * Creator payments land 45–90 days after the work, so a dashboard built only
 * on money received reports on a quarter that is already over — it cannot tell
 * her whether this month is going well while there is still time to act on it.
 * Received, pending and overdue all sit directly underneath.
 *
 * Same bento as Home (DESIGN.md §2, §4): one contrast card carrying the
 * headline, supporting tiles beside it, charts in cards below.
 */
export default function MoneyScreen() {
  const { c } = useTheme()
  const { isWide, isDesktop } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()

  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Fetched independently rather than with Promise.all — invoices come from a
  // newer table than deals/payments, so one being unavailable should not blank
  // out the figures the other half can still compute.
  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true)
      try {
        setDeals(await getDeals())
      } catch {
        toast('Could not load your deals', { tone: 'error' })
      }
      try {
        setInvoices(await getInvoices())
      } catch {
        // Non-fatal: the invoices row just shows zero until this succeeds.
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

  const summary = useMemo(() => computeRevenueSummary(deals), [deals])

  const chartData = useMemo(
    () => summary.monthlyTotals.map((month) => ({ label: month.label, value: month.total })),
    [summary]
  )

  const onTrack = Math.max(summary.pending.value - summary.overdue.value, 0)
  const collected = summary.monthlyTotals.reduce((sum, month) => sum + month.total, 0)

  const hero = (
    <HeroCard
      label="Locked this month"
      value={summary.lockedThisMonth.value}
      format={formatCurrency}
      caption={
        summary.lockedThisMonth.count === 0
          ? 'No new deals logged this month yet. This is the number that moves first.'
          : `Across ${summary.lockedThisMonth.count} new ${summary.lockedThisMonth.count === 1 ? 'deal' : 'deals'} signed this month.`
      }
      action={{ label: 'Invoices', onPress: () => router.push('/(app)/invoices' as never) }}
      stats={[
        { label: 'Landed', value: formatCurrencyCompact(summary.earnedThisMonth.value) },
        { label: 'Still out', value: formatCurrencyCompact(onTrack), dotColor: c.accent },
        {
          label: 'Overdue',
          value: formatCurrencyCompact(summary.overdue.value),
          dotColor: c.danger,
        },
      ]}
      aside={
        isWide && summary.pending.value > 0 ? (
          <DonutChart
            segments={[
              { label: 'On track', value: onTrack, color: c.accent },
              { label: 'Overdue', value: summary.overdue.value, color: c.danger },
            ]}
            size={108}
            strokeWidth={11}
            trackColor={c.onContrastFaint}
            textColor={c.onContrast}
            mutedTextColor={c.onContrastMuted}
            centerLabel={formatCurrencyCompact(summary.pending.value)}
            centerCaption="unpaid"
          />
        ) : null
      }
    />
  )

  const tiles = (
    <View style={isDesktop ? styles.tileColumn : styles.tileRow}>
      <StatTile
        label="Landed this month"
        value={summary.earnedThisMonth.value}
        format={formatCurrency}
        tone="success"
        caption={`${summary.earnedThisMonth.count} ${summary.earnedThisMonth.count === 1 ? 'payment' : 'payments'} received`}
        index={1}
      />
      <StatTile
        label="Average deal"
        value={summary.averageDealValue}
        format={formatCurrency}
        caption={`${deals.length} ${deals.length === 1 ? 'deal' : 'deals'} on record`}
        index={2}
      />
      <StatTile
        label="Deals closed"
        value={summary.dealsClosed}
        caption="paid in full, all time"
        index={3}
      />
    </View>
  )

  const chart = (
    <Card style={styles.blockCard}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Last six months</Text>
          <Text style={[styles.cardSub, { color: c.textMuted }]}>
            Payments received. Tap a bar for the exact figure.
          </Text>
        </View>
        <Text style={[styles.cardFigure, { color: c.textPrimary }]}>
          {formatCurrencyCompact(collected)}
        </Text>
      </View>
      <BarChart
        data={chartData}
        height={140}
        fill={isDesktop}
        formatValue={formatCurrencyCompact}
      />
    </Card>
  )

  const side = (
    <View style={isDesktop ? styles.sideColumn : styles.stack}>
      {summary.bestPayingBrand ? (
        <Card style={styles.sideCard}>
          <Text style={[styles.cardSub, { color: c.textMuted }]}>Best payer</Text>
          <Text style={[styles.bestBrand, { color: c.textPrimary }]} numberOfLines={1}>
            {summary.bestPayingBrand.name}
          </Text>
          <Text style={[styles.cardSub, { color: c.textSecondary }]}>
            {formatCurrency(summary.bestPayingBrand.total)} paid to you so far
          </Text>
        </Card>
      ) : null}

      {/* Invoices live here and nowhere else — they used to be reachable from
          both Money and Settings, which meant neither felt like where they
          belonged. */}
      <View style={styles.links}>
        <ListRow
          title="Invoices"
          subtitle={
            invoices.length === 0
              ? 'Bill a brand with GST'
              : `${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'} raised`
          }
          leading={
            <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
              <Ionicons name="document-text" size={18} color={c.accent} />
            </View>
          }
          showChevron
          onPress={() => router.push('/(app)/invoices' as never)}
          index={0}
        />
        <ListRow
          title="Year in review"
          subtitle="Income, TDS and GST for the financial year"
          leading={
            <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
              <Ionicons name="bar-chart" size={18} color={c.accent} />
            </View>
          }
          showChevron
          onPress={() => router.push('/(app)/annual-report' as never)}
          index={1}
        />
      </View>
    </View>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
      <ScrollView
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
          title="Money"
          subtitle="What you locked, what landed, what is still out."
          leadingAction={<HeaderUtilities />}
          actions={[
            {
              icon: 'add',
              label: 'New invoice',
              primary: true,
              onPress: () => router.push('/(app)/invoice/new' as never),
            },
          ]}
        >
          {loading ? (
            <View style={styles.stack}>
              <Skeleton height={200} radius={Radius.lg} />
            </View>
          ) : (
            <View style={isDesktop ? styles.rowA : styles.stack}>
              <View style={isDesktop ? styles.heroCell : undefined}>{hero}</View>
              <View style={isDesktop ? styles.asideCell : undefined}>{tiles}</View>
            </View>
          )}
        </ScreenHeader>

        {loading ? (
          <View style={styles.stack}>
            <Skeleton height={190} radius={Radius.md} />
          </View>
        ) : (
          <View style={isDesktop ? styles.rowB : styles.stack}>
            <View style={isDesktop ? styles.chartCell : undefined}>{chart}</View>
            <View style={isDesktop ? styles.sideCell : undefined}>{side}</View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
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
  sideCell: {
    flex: 1,
  },
  tileColumn: {
    flex: 1,
    gap: ColumnGap,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sideColumn: {
    flex: 1,
    gap: ColumnGap,
  },
  blockCard: {
    flex: 1,
    padding: Spacing.md + 2,
    gap: Spacing.md,
  },
  sideCard: {
    padding: Spacing.md + 2,
    gap: 2,
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
  bestBrand: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  links: {
    gap: 10,
  },
  linkIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
