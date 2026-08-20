import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import {
  getDeals,
  nextDuePayment,
  paymentsInOrder,
  type DealWithPaymentSummary,
} from '@/lib/deals'
import { computeRevenueSummary } from '@/lib/revenue'
import { getInvoices } from '@/lib/invoices'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  parseLocalDate,
} from '@/lib/format'
import { PLATFORM_LABELS } from '@/constants/labels'
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
import { useAuth } from '@/hooks/useAuth'
import { DealRow } from '@/components/DealRow'
import {
  type CalendarMark,
  CountBadge,
  DataTable,
  type DataTableColumn,
  HeaderUtilities,
  HeroCard,
  ListRow,
  Panel,
  PaymentCalendar,
  Reveal,
  RevealScrollView,
  ScreenHeader,
  Skeleton,
  StatTile,
  useToast,
  ViewAllLink,
} from '@/components/ui'
import { StatusPill } from '@/components/StatusPill'
import { BrandAvatar } from '@/components/BrandAvatar'

/**
 * Money.
 *
 * A strip of four figures, then the one magenta card, the payment calendar
 * and the record, then everything still owed as a table (20 Aug redesign).
 * The phone stacks the same pieces.
 *
 * This replaced three full-bleed gradient cards carrying an orbit ring and a
 * dot matrix between them. They stated what was outstanding without ever
 * showing *which* deals made it up, and on a phone you reached the bottom of
 * the screen before meeting a single date.
 *
 * `earnedThisMonth` deliberately does not lead: creator payments land 45 to
 * 90 days after the work, so a screen built on money received reports on a
 * quarter that is already over. What is still owed is what the tab is opened
 * to check, so it leads the strip.
 */
export default function MoneyScreen() {
  const { c } = useTheme()
  const { session } = useAuth()
  const { isDesktop } = useBreakpoint()
  const router = useRouter()
  const toast = useToast()

  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Fetched independently rather than with Promise.all: invoices come from a
  // newer table than deals/payments, so one being unavailable should not blank
  // out the figures the other half can still compute.
  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true)
      try {
        setDeals(await getDeals())
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
    [toast, session]
  )

  useFocusEffect(
    useCallback(() => {
      load('initial')
    }, [load])
  )

  const summary = useMemo(() => computeRevenueSummary(deals), [deals])

  const onTrack = Math.max(summary.pending.value - summary.overdue.value, 0)
  const collected = summary.monthlyTotals.reduce((sum, month) => sum + month.total, 0)

  /** Every unpaid deal, soonest due first. The list under the cards. */
  const unpaid = useMemo(
    () =>
      deals
        // Held deals are not waiting on payment, they are paused (§8.6).
        .filter((deal) => !deal.on_hold && nextDuePayment(deal) !== null)
        .sort((a, b) =>
          (nextDuePayment(a)?.due_date ?? '9999').localeCompare(
            nextDuePayment(b)?.due_date ?? '9999'
          )
        ),
    [deals]
  )


  const sixMonthCount = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    return deals.filter((deal) => {
      return paymentsInOrder(deal).some(
        (payment) =>
          payment.status === 'paid' &&
          payment.paid_date &&
          parseLocalDate(payment.paid_date) >= cutoff
      )
    }).length
  }, [deals])

  /**
   * This month's payments, for the calendar.
   *
   * Both kinds in one pass: a due date that has not been met is money
   * expected, a paid date is money that arrived. Only the current month's
   * marks are kept, since that is all the grid draws.
   */
  const calendarMarks = useMemo<CalendarMark[]>(() => {
    const now = new Date()
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`
    const marks: CalendarMark[] = []

    for (const deal of deals) {
      for (const payment of paymentsInOrder(deal)) {
        if (payment.status === 'paid' && payment.paid_date?.startsWith(prefix)) {
          marks.push({ date: payment.paid_date, kind: 'paid' })
        } else if (payment.status !== 'paid' && payment.due_date?.startsWith(prefix)) {
          marks.push({ date: payment.due_date, kind: 'due' })
        }
      }
    }
    return marks
  }, [deals])

  const monthLabel = new Date().toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

  /** The best of the six months on record, for the hero's footer strip. */
  const bestMonth = useMemo(
    () =>
      summary.monthlyTotals.reduce<{ label: string; total: number } | null>(
        (best, month) => (best === null || month.total > best.total ? month : best),
        null
      ),
    [summary.monthlyTotals]
  )

  // ── Desktop blocks (20 Aug redesign, Phase 3) ─────────────────────────

  const metricTiles = (
    <View style={styles.metricRow}>
      <StatTile
        dense
        index={0}
        label="Still out"
        value={summary.pending.value}
        format={formatCurrency}
        caption={`${summary.pending.count} unpaid ${summary.pending.count === 1 ? 'deal' : 'deals'}`}
      />
      <StatTile
        dense
        index={1}
        label="Received, six months"
        value={collected}
        format={formatCurrency}
        caption={`${sixMonthCount} ${sixMonthCount === 1 ? 'deal' : 'deals'} paid`}
      />
      <StatTile
        dense
        index={2}
        label="Overdue"
        value={summary.overdue.value}
        format={formatCurrency}
        tone={summary.overdue.value > 0 ? 'danger' : 'default'}
        caption={
          summary.overdue.count === 0
            ? 'nothing is late'
            : `${summary.overdue.count} ${summary.overdue.count === 1 ? 'payment' : 'payments'} late`
        }
      />
      <StatTile
        dense
        index={3}
        label="On track"
        value={onTrack}
        format={formatCurrency}
        caption="due, not yet late"
      />
    </View>
  )

  const receivedHero = (
    <HeroCard
      label="Received"
      value={collected}
      format={formatCurrency}
      caption={`${summary.monthlyTotals.length} months, ${sixMonthCount} ${sixMonthCount === 1 ? 'deal' : 'deals'} paid`}
      // The footer strip is what stops the card being a figure floating in a
      // large empty rectangle: it is the tallest cell in its row, so without
      // it the bottom half is void.
      stats={[
        { label: 'This month', value: formatCurrencyCompact(summary.earnedThisMonth.value) },
        { label: bestMonth ? `Best · ${bestMonth.label}` : 'Best month', value: bestMonth ? formatCurrencyCompact(bestMonth.total) : '—' },
      ]}
      gradient="magenta"
      action={{
        label: 'Year report',
        onPress: () => router.push('/(app)/annual-report' as never),
      }}
      onPress={() => router.push('/(app)/annual-report' as never)}
      style={styles.fill}
    />
  )

  const calendarPanel = (
    <Panel title="Payment calendar" subtitle={monthLabel} fill>
      <PaymentCalendar marks={calendarMarks} />
    </Panel>
  )

  const recordPanel = (
    <Panel title="The record" fill>
      <View style={styles.recordLines}>
        <RecordLine label="Average deal" value={formatCurrency(summary.averageDealValue)} />
        <RecordLine label="Deals on record" value={String(deals.length)} />
        <RecordLine label="Paid in full" value={String(summary.dealsClosed)} />
        {summary.collection ? (
          <RecordLine
            label={
              summary.collection.averageDays <= 0
                ? 'Collected on time'
                : `Collected, ${summary.collection.averageDays}d late`
            }
            value={`${summary.collection.rate}%`}
          />
        ) : null}
        {summary.bestPayingBrand ? (
          <RecordLine
            label={`Best payer · ${summary.bestPayingBrand.name}`}
            value={formatCurrencyCompact(summary.bestPayingBrand.total)}
          />
        ) : null}
      </View>
    </Panel>
  )

  const unpaidColumns: DataTableColumn<DealWithPaymentSummary>[] = [
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
      render: (deal) => {
        const next = nextDuePayment(deal)
        return (
          <Text style={[styles.cellMuted, { color: c.textMuted }]} numberOfLines={1}>
            {next?.due_date ? formatDate(next.due_date) : '—'}
          </Text>
        )
      },
    },
  ]

  const unpaidTable = (
    <Panel
      title="To be paid"
      count={unpaid.length}
      action={
        unpaid.length > 6 ? (
          <ViewAllLink
            label={`View all ${unpaid.length}`}
            onPress={() => router.push('/(app)/deals?filter=unpaid' as never)}
          />
        ) : undefined
      }
    >
      <DataTable
        columns={unpaidColumns}
        rows={unpaid.slice(0, 6)}
        keyOf={(deal) => deal.id}
        onRowPress={(deal) => router.push(`/(app)/deal/${deal.id}` as never)}
      />
    </Panel>
  )

  const links = (
    <View style={styles.links}>
      {/* Invoices live here and nowhere else. They used to be reachable from
          both Money and Settings, which meant neither felt like where they
          belonged. */}
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
            <Skeleton height={isDesktop ? 120 : 420} radius={Radius.card} />
          ) : isDesktop ? (
            metricTiles
          ) : (
            // The phone gets the same shape as desktop, stacked: one hero,
            // then the two figures worth checking, then the calendar. It used
            // to stack three full-bleed gradient cards, which is a screen and
            // a half before any date or deal appears.
            <View style={styles.cardStack}>
              {receivedHero}
              <View style={styles.phoneTileRow}>
                <StatTile
                  dense
                  index={0}
                  label="Still out"
                  value={summary.pending.value}
                  format={formatCurrencyCompact}
                />
                <StatTile
                  dense
                  index={1}
                  label="Overdue"
                  value={summary.overdue.value}
                  format={formatCurrencyCompact}
                  tone={summary.overdue.value > 0 ? 'danger' : 'default'}
                />
              </View>
              <Panel title="Payment calendar" subtitle={monthLabel}>
                <PaymentCalendar marks={calendarMarks} />
              </Panel>
            </View>
          )}
        </ScreenHeader>

        {loading ? (
          <Skeleton height={140} radius={Radius.lg} />
        ) : isDesktop ? (
          <>
            {/* One saturated card, the calendar, and the supporting figures,
                all ending on the same line. */}
            <Reveal>
              <View style={styles.mainRow}>
                <View style={styles.heroCell}>{receivedHero}</View>
                <View style={styles.calendarCell}>{calendarPanel}</View>
                <View style={styles.recordCell}>{recordPanel}</View>
              </View>
            </Reveal>
            {unpaid.length > 0 ? <Reveal delay={70}>{unpaidTable}</Reveal> : null}
          </>
        ) : (
          <>
            <Reveal>{links}</Reveal>

            {/* The deals behind the blue card's figure. Money used to state
                what was outstanding and then give no way to see *which*
                deals made it up without going to Invoices, which lists
                something else entirely. */}
            {unpaid.length > 0 ? (
              <Reveal delay={70}>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>To be paid</Text>
                  <CountBadge count={unpaid.length} size={26} />
                </View>
                {unpaid.slice(0, 6).map((deal, index) => (
                  <DealRow
                    key={deal.id}
                    deal={deal}
                    index={index}
                    variant="plain"
                    onPress={() => router.push(`/(app)/deal/${deal.id}` as never)}
                  />
                ))}
                {unpaid.length > 6 ? (
                  <ViewAllLink
                    label={`View all ${unpaid.length}`}
                    onPress={() => router.push('/(app)/deals?filter=unpaid' as never)}
                    style={styles.phoneViewAll}
                  />
                ) : null}
              </Reveal>
            ) : null}
          </>
        )}
      </RevealScrollView>
    </SafeAreaView>
  )
}

/**
 * A label and a figure on one line, on a page surface.
 *
 * `StatLine` below does the same job on the ink gradient card, where the type
 * is always white; this one reads its colours from the theme. Two components
 * rather than one with a colour prop, because the gradient version also sets
 * its own opacity and the shared version would be mostly branches.
 */
function RecordLine({ label, value }: { label: string; value: string }) {
  const { c } = useTheme()
  return (
    <View style={styles.recordLine}>
      <Text style={[styles.recordLabel, { color: c.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.recordValue, { color: c.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
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

  cardStack: {
    gap: Spacing.md,
  },
  phoneTileRow: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  cardRow: {
    flexDirection: 'row',
    gap: ColumnGap,
    alignItems: 'stretch',
  },
  cardCell: {
    flex: 1,
  },

  // ── The desktop dashboard (Phase 3) ──────────────────────────────────
  metricRow: {
    flexDirection: 'row',
    gap: ColumnGap,
  },
  mainRow: {
    flexDirection: 'row',
    gap: ColumnGap,
    alignItems: 'stretch',
    marginBottom: Spacing.md,
  },
  heroCell: {
    flex: 1.15,
  },
  calendarCell: {
    flex: 1.4,
  },
  recordCell: {
    flex: 1,
  },
  recordLines: {
    gap: 2,
  },
  recordLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: 7,
  },
  recordLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    flexShrink: 1,
  },
  recordValue: {
    ...Typography.caption,
    fontFamily: FontFamily.semiBold,
    fontVariant: ['tabular-nums'],
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
  phoneViewAll: {
    marginTop: Spacing.base,
    marginLeft: Spacing.xs,
  },
  fill: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  // Absorbs the extra height when a taller card in the row sets it. The flex
  // is on the slot, not the ring: the ring is a fixed-size SVG and stretching
  // it ovals the circles.
  ringSlot: {
    marginVertical: Spacing.lg,
    flex: 1,
    justifyContent: 'center',
  },
  lines: {
    marginTop: 'auto',
    paddingTop: Spacing.xl,
    gap: Spacing.base,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  lineLabel: {
    flex: 1,
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.62)',
  },

  links: {
    gap: Spacing.base,
    marginTop: Spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  linkIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
