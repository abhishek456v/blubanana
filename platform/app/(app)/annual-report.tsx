import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { getDeals, type DealWithPaymentSummary } from '@/lib/deals'
import { getInvoices } from '@/lib/invoices'
import { getAllRatings } from '@/lib/reputation'
import { getExpenses, type Expense } from '@/lib/expenses'
import {
  EMPTY_ADJUSTMENTS,
  computeAnnualReport,
  currentFinancialYearStart,
  getAdjustments,
  hasAdjustments,
  saveAdjustments,
  type AnnualAdjustments,
} from '@/lib/annualReport'
import { AnnualAdjustmentsSheet } from '@/components/AnnualAdjustmentsSheet'
import { formatCurrency } from '@/lib/format'
import type { BrandRating, Invoice } from '@/types'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import {
  Button,
  Card,
  Figure,
  EmptyState,
  MetricCard,
  PressableScale,
  Skeleton,
  useToast,
} from '@/components/ui'

export default function AnnualReportScreen() {
  const toast = useToast()
  const { c } = useTheme()
  const isWide = useIsWideScreen()

  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [ratings, setRatings] = useState<BrandRating[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [fyStartYear, setFyStartYear] = useState(currentFinancialYearStart())
  const [adjustments, setAdjustments] = useState<AnnualAdjustments>(EMPTY_ADJUSTMENTS)
  const [correcting, setCorrecting] = useState(false)
  const [savingAdjustments, setSavingAdjustments] = useState(false)

  // Fetched independently: invoices/ratings depend on migration 006 (newer,
  // separate tables), so either being unavailable shouldn't block the
  // deal-based numbers, which have worked since migration 001.
  const load = useCallback(async () => {
    try {
      setDeals(await getDeals())
    } catch {
      toast('Could not load deals', { tone: 'error' })
    }
    try {
      setInvoices(await getInvoices())
    } catch {
      // Non-fatal: the tax block shows zero until this succeeds.
    }
    try {
      setExpenses(await getExpenses())
    } catch {
      // Non-fatal: the report falls back to reporting gross, which is what it
      // did before expenses existed.
    }
    try {
      setAdjustments(await getAdjustments(fyStartYear))
    } catch {
      // Non-fatal: the report shows the app's own figures, which is what it did
      // before corrections existed.
    }
    try {
      setRatings(await getAllRatings())
    } catch {
      // Non-fatal: the toughest-client line just doesn't show.
    } finally {
      setLoading(false)
    }
  }, [toast, fyStartYear])

  useEffect(() => {
    load()
  }, [load])

  async function handleSaveAdjustments(next: AnnualAdjustments) {
    setSavingAdjustments(true)
    try {
      await saveAdjustments(fyStartYear, next)
      setAdjustments(next)
      setCorrecting(false)
    } catch {
      toast('Could not save those corrections', { tone: 'error' })
    } finally {
      setSavingAdjustments(false)
    }
  }

  const report = useMemo(
    () => computeAnnualReport(deals, invoices, ratings, expenses, fyStartYear, adjustments),
    [deals, invoices, ratings, expenses, fyStartYear, adjustments]
  )

  const atCurrentYear = fyStartYear >= currentFinancialYearStart()
  const isEmpty = report.totalRevenue === 0 && report.dealsClosed === 0

  // The hero and the hand-added corrections are one thought; the six figures
  // are a grid, not three stacked pairs; and the two client cards are a pair.
  // Stacked in one column on a desktop, the year's headline sat alone with a
  // 900px void beside it and everything worth reading started below the fold.
  const hero = (
    <Card style={[styles.hero, { backgroundColor: c.accentLight }]}>
      <Text style={[styles.heroLabel, { color: c.textSecondary }]}>You earned</Text>
      <Figure
        value={formatCurrency(report.totalRevenue)}
        count
        format={formatCurrency}
        size={38}
        color={c.accentText}
        bold
      />
      <Text style={[styles.heroCaption, { color: c.textSecondary }]}>
        across {report.dealsClosed} closed {report.dealsClosed === 1 ? 'deal' : 'deals'} in{' '}
        {report.fyLabel}
      </Text>
    </Card>
  )

  // Both sides, never merged. The app's figure stays visible next to what she
  // added, so she and her accountant can always see which is which. §8.13.
  const adjusted = hasAdjustments(report.adjustments) ? (
    <Card style={styles.adjusted}>
      <Text style={[styles.adjustedLabel, { color: c.textSecondary }]}>
        With what you added by hand
      </Text>
      <View style={styles.adjustedRow}>
        <Text style={[styles.adjustedKey, { color: c.textSecondary }]}>Earned</Text>
        <Text style={[styles.adjustedValue, { color: c.textPrimary }]}>
          {formatCurrency(report.adjustedRevenue)}
        </Text>
      </View>
      <View style={styles.adjustedRow}>
        <Text style={[styles.adjustedKey, { color: c.textSecondary }]}>Expenses</Text>
        <Text style={[styles.adjustedValue, { color: c.textPrimary }]}>
          {formatCurrency(report.adjustedExpenses)}
        </Text>
      </View>
      <View style={styles.adjustedRow}>
        <Text style={[styles.adjustedKey, { color: c.textSecondary }]}>Taxable income</Text>
        <Text style={[styles.adjustedValue, { color: c.accentText }]}>
          {formatCurrency(report.adjustedNetIncome)}
        </Text>
      </View>
      <View style={styles.adjustedRow}>
        <Text style={[styles.adjustedKey, { color: c.textSecondary }]}>TDS</Text>
        <Text style={[styles.adjustedValue, { color: c.textPrimary }]}>
          {formatCurrency(report.adjustedTdsDeducted)}
        </Text>
      </View>
      {report.adjustments.note ? (
        <Text style={[styles.adjustedNote, { color: c.textMuted }]}>
          {report.adjustments.note}
        </Text>
      ) : null}
    </Card>
  ) : null

  // One list, so the desktop grid and the phone's pairs are the same figures
  // in the same order rather than two hand-kept copies.
  const metrics = [
    ...(report.totalExpenses > 0
      ? [
          { label: 'Expenses', value: report.totalExpenses, format: formatCurrency, caption: 'what the work cost' },
          { label: 'Taxable income', value: report.netIncome, format: formatCurrency, tone: 'accent' as const, caption: 'earned minus expenses' },
        ]
      : []),
    { label: 'GST collected', value: report.gstCollected, format: formatCurrency },
    { label: 'TDS deducted', value: report.tdsDeducted, format: formatCurrency, caption: 'claim against 26AS' },
    { label: 'Payments settled', value: report.paymentsResolved },
    { label: 'Deals closed', value: report.dealsClosed },
  ]

  // Wrapped in a cell rather than styled through MetricCard's own `style`.
  // Its wrapper carries `flex: 1`, which react-native-web emits as the CSS
  // shorthand, and a shorthand beats the `flexBasis` longhand no matter which
  // order the style array is in. Six tiles stayed six tiles across and every
  // lakh-scale figure truncated to "₹1,03,…".
  const metricCards = metrics.map((metric, index) => (
    <View key={metric.label} style={isWide ? styles.metricCell : styles.metricCellPhone}>
      <MetricCard {...metric} index={index} />
    </View>
  ))

  // Placed under the figures, not above them: the app's own numbers are the
  // starting point, and this is the correction to them. §8.13.
  const correctButton = (
    <Button
      label={
        hasAdjustments(report.adjustments)
          ? 'Edit what you added'
          : 'Add income or costs this missed'
      }
      variant="secondary"
      onPress={() => setCorrecting(true)}
      fullWidth
    />
  )

  const clientCards = [
    report.bestClient ? (
      <Card key="best" style={isWide ? styles.clientCell : undefined}>
        <Text style={[styles.cardLabel, { color: c.textSecondary }]}>Best client</Text>
        <Text style={[styles.cardValue, { color: c.textPrimary }]}>{report.bestClient.name}</Text>
        <Text style={[styles.cardHint, { color: c.textMuted }]}>
          {formatCurrency(report.bestClient.total)} paid to you this year
        </Text>
      </Card>
    ) : null,
    report.worstClient ? (
      <Card key="worst" style={isWide ? styles.clientCell : undefined}>
        <Text style={[styles.cardLabel, { color: c.textSecondary }]}>Toughest to work with</Text>
        <Text style={[styles.cardValue, { color: c.textPrimary }]}>{report.worstClient.name}</Text>
        <Text style={[styles.cardHint, { color: c.textMuted }]}>
          You rated them {report.worstClient.averageRating.toFixed(1)} out of 5
        </Text>
      </Card>
    ) : null,
  ].filter(Boolean)

  const footnote = (
    <Text style={[styles.footnote, { color: c.textMuted }]}>
      Indian financial year, April to March. Figures come from payments marked received and
      invoices raised inside {report.fyLabel}.
    </Text>
  )

  return (
    <ModalSheet title="Year report" wide>
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={[styles.content, isWide && styles.contentWide]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.yearRow}>
            <PressableScale
              onPress={() => setFyStartYear((y) => y - 1)}
              hitSlop={HitSlop}
              haptic="selection"
              accessibilityLabel="Previous financial year"
            >
              <Ionicons name="chevron-back" size={20} color={c.textSecondary} />
            </PressableScale>

            <Text style={[styles.yearLabel, { color: c.textPrimary }]}>{report.fyLabel}</Text>

            <PressableScale
              onPress={() => setFyStartYear((y) => Math.min(currentFinancialYearStart(), y + 1))}
              hitSlop={HitSlop}
              haptic="selection"
              disabled={atCurrentYear}
              accessibilityLabel="Next financial year"
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={atCurrentYear ? c.textMuted : c.textSecondary}
              />
            </PressableScale>
          </View>

          {loading ? (
            <View style={styles.section}>
              <Skeleton height={132} radius={Radius.md} />
              <Skeleton height={92} radius={Radius.md} />
              <Skeleton height={92} radius={Radius.md} />
            </View>
          ) : isEmpty ? (
            <EmptyState
              icon="calendar-outline"
              title="Nothing this year"
              message="Once payments land inside this financial year, your income, TDS and GST all show up here."
            />
          ) : isWide ? (
            <View style={styles.section}>
              <View style={styles.topRow}>
                <View style={styles.heroCell}>{hero}</View>
                {adjusted ? <View style={styles.adjustedCell}>{adjusted}</View> : null}
              </View>
              <View style={styles.metricGrid}>{metricCards}</View>
              {clientCards.length > 0 ? (
                <View style={styles.clientRow}>{clientCards}</View>
              ) : null}
              {correctButton}
              {footnote}
            </View>
          ) : (
            <View style={styles.section}>
              {hero}
              {adjusted}
              <View style={styles.metrics}>{metricCards}</View>
              {correctButton}
              {clientCards}
              {footnote}
            </View>
          )}
        </ScrollView>

      <AnnualAdjustmentsSheet
        visible={correcting}
        fyLabel={report.fyLabel}
        adjustments={adjustments}
        saving={savingAdjustments}
        onClose={() => setCorrecting(false)}
        onSave={handleSaveAdjustments}
      />

      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
  adjusted: {
    gap: 6,
  },
  adjustedLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  adjustedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  adjustedKey: { fontSize: 14 },
  adjustedValue: { fontSize: 15, fontWeight: '600' },
  adjustedNote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  safe: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  contentWide: {
    padding: Spacing.lg,
    width: '100%',
    alignSelf: 'center',
  },
  section: {
    gap: Spacing.sm,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  yearLabel: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  hero: {
    padding: Spacing.lg,
    gap: Spacing.xxs,
  },
  heroLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  heroCaption: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  // Six figures on a phone, two to a line. Fixed basis rather than flex, so a
  // list of five wraps to 2/2/1 instead of stretching the last one across.
  // `alignItems` and `alignContent` are both pinned to the start. A wrapped
  // flex container stretches its lines by default, and inside a ScrollView
  // with a definite height that turned six tiles into six half-empty columns
  // 400px tall.
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'stretch',
  },
  heroCell: {
    flex: 1.2,
  },
  adjustedCell: {
    flex: 1,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  // Three to a row at the sheet's width.
  metricCell: {
    flexGrow: 1,
    flexBasis: 290,
  },
  // Two to a row on a phone.
  metricCellPhone: {
    flexGrow: 1,
    flexBasis: '46%',
  },
  clientRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  clientCell: {
    flex: 1,
  },
  cardLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  cardValue: {
    ...Typography.title,
    fontFamily: FontFamily.display,
    marginTop: Spacing.xxs,
  },
  cardHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },
  footnote: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
})
