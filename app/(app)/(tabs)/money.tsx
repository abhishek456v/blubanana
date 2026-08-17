import { useCallback, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import { getDeals, type DealWithPaymentSummary } from '@/lib/deals'
import { computeRevenueSummary } from '@/lib/revenue'
import { getInvoices } from '@/lib/invoices'
import { getPaymentAlertTone } from '@/lib/paymentReminders'
import { formatCurrency, formatCurrencyCompact, parseLocalDate } from '@/lib/format'
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
import { EarningsCard } from '@/components/home'
import { DealRow } from '@/components/DealRow'
import {
  CircleButton,
  CountBadge,
  Figure,
  FigureBlock,
  GradientCard,
  HeaderUtilities,
  ListRow,
  OrbitRing,
  Reveal,
  RevealScrollView,
  ScreenHeader,
  Skeleton,
  useToast,
  type OrbitItem,
} from '@/components/ui'

/**
 * Money.
 *
 * Three cards, in the order the questions get asked: what is still out, what
 * actually arrived, and what this month has locked in.
 *
 * "Locked" leads the third card rather than the screen because creator
 * payments land 45 to 90 days after the work; a screen built only on money
 * received reports on a quarter that is already over and cannot tell her
 * whether *this* month is going well while there is still time to act on it.
 * But what she is owed is the thing she opens this tab to check, so it goes
 * first.
 */
export default function MoneyScreen() {
  const { c } = useTheme()
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

  const onTrack = Math.max(summary.pending.value - summary.overdue.value, 0)
  const collected = summary.monthlyTotals.reduce((sum, month) => sum + month.total, 0)

  /** Every unpaid deal, soonest due first. The list under the cards. */
  const unpaid = useMemo(
    () =>
      deals
        .filter((deal) => deal.payment && deal.payment.status !== 'paid')
        .sort((a, b) =>
          (a.payment!.due_date ?? '9999').localeCompare(b.payment!.due_date ?? '9999')
        ),
    [deals]
  )

  /**
   * Who is holding money, overdue first. Drives the blue card's ring.
   *
   * Deduplicated by brand, not by deal: the ring answers "who owes me", and a
   * brand running two deals at once would otherwise occupy two chips with the
   * same two initials, which reads as a rendering fault rather than as two
   * invoices.
   */
  const debtors = useMemo<OrbitItem[]>(() => {
    const overdueFirst = [...unpaid].sort((a, b) => {
      const aLate = getPaymentAlertTone(a.payment!) === 'overdue' ? 0 : 1
      const bLate = getPaymentAlertTone(b.payment!) === 'overdue' ? 0 : 1
      return aLate - bLate
    })

    const seen = new Set<string>()
    const chips: OrbitItem[] = []
    for (const deal of overdueFirst) {
      const brandName = deal.brand?.name ?? 'Unknown brand'
      if (seen.has(brandName)) continue
      seen.add(brandName)
      chips.push({ id: brandName, label: brandName })
      if (chips.length === 6) break
    }
    return chips
  }, [unpaid])

  const sixMonthCount = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    return deals.filter((deal) => {
      const paidDate = deal.payment?.paid_date
      return deal.payment?.status === 'paid' && paidDate && parseLocalDate(paidDate) >= cutoff
    }).length
  }, [deals])

  const stillOut = (
    <GradientCard
      gradient="blue"
      title="Still out"
      style={styles.fill}
      onPress={() => router.push('/(app)/invoices' as never)}
      accessibilityLabel={`Still out: ${formatCurrency(summary.pending.value)} across ${summary.pending.count} unpaid deals.`}
      action={
        <CircleButton icon="arrow-forward" iconRotate={-45} accessibilityLabel="Open invoices" />
      }
    >
      <FigureBlock
        label={
          summary.pending.count === 1
            ? 'across 1 unpaid deal'
            : `across ${summary.pending.count} unpaid deals`
        }
        figure={
          <Figure value={formatCurrency(summary.pending.value)} size="hero" color="#FFFFFF" bold />
        }
      />

      <View style={styles.ringSlot}>
        <OrbitRing
          center={debtors[0] ?? null}
          items={debtors.slice(1)}
          size={170}
        />
      </View>

      <View style={styles.row}>
        <FigureBlock
          reverse
          label="On track"
          figure={<Figure value={formatCurrencyCompact(onTrack)} size="lg" color="#FFFFFF" />}
        />
        <FigureBlock
          reverse
          align="right"
          label="Overdue"
          figure={
            <Figure
              value={formatCurrencyCompact(summary.overdue.value)}
              size="lg"
              // Overdue keeps the card's own white rather than turning red.
              // On a saturated blue ground a red figure reads as a rendering
              // fault, and the label already names it; the amount being
              // non-zero is the alarm.
              color="#FFFFFF"
            />
          }
        />
      </View>
    </GradientCard>
  )

  const thisMonth = (
    <GradientCard gradient="ink" title="This month" style={styles.fill}>
      <FigureBlock
        label={
          summary.lockedThisMonth.count === 1
            ? 'locked in 1 new deal'
            : `locked in ${summary.lockedThisMonth.count} new deals`
        }
        figure={
          <Figure
            value={formatCurrency(summary.lockedThisMonth.value)}
            size="hero"
            color="#FFFFFF"
            bold
          />
        }
      />

      <View style={styles.lines}>
        <StatLine label="Average deal" value={formatCurrency(summary.averageDealValue)} />
        <StatLine label="Deals on record" value={String(deals.length)} />
        <StatLine label="Paid in full, all time" value={String(summary.dealsClosed)} />
        {summary.bestPayingBrand ? (
          <StatLine
            label={`Best payer · ${summary.bestPayingBrand.name}`}
            value={formatCurrencyCompact(summary.bestPayingBrand.total)}
          />
        ) : null}
      </View>
    </GradientCard>
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
            <Skeleton height={420} radius={Radius.card} />
          ) : (
            <View style={isDesktop ? styles.cardRow : styles.cardStack}>
              <View style={isDesktop ? styles.cardCell : undefined}>{stillOut}</View>
              <View style={isDesktop ? styles.cardCell : undefined}>
                {/* The same card Home carries. The six-month series has one
                    correct shape in this app, and drawing it twice in two
                    idioms is how two screens end up disagreeing about it. */}
                <EarningsCard
                  received={collected}
                  count={sixMonthCount}
                  monthly={summary.monthlyTotals}
                  onPress={() => router.push('/(app)/annual-report' as never)}
                />
              </View>
              <View style={isDesktop ? styles.cardCell : undefined}>{thisMonth}</View>
            </View>
          )}
        </ScreenHeader>

        {loading ? (
          <Skeleton height={140} radius={Radius.lg} />
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
                  <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
                    Waiting on payment
                  </Text>
                  <CountBadge count={unpaid.length} size={26} />
                </View>
                {unpaid.map((deal, index) => (
                  <DealRow
                    key={deal.id}
                    deal={deal}
                    index={index}
                    variant="plain"
                    dense={isDesktop}
                    onPress={() => router.push(`/(app)/deal/${deal.id}` as never)}
                  />
                ))}
              </Reveal>
            ) : null}
          </>
        )}
      </RevealScrollView>
    </SafeAreaView>
  )
}

/** A label and a figure on one line, for the ink card's supporting numbers. */
function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel} numberOfLines={1}>
        {label}
      </Text>
      <Figure value={value} size="sm" color="#FFFFFF" />
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
  cardRow: {
    flexDirection: 'row',
    gap: ColumnGap,
    alignItems: 'stretch',
  },
  cardCell: {
    flex: 1,
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
