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
import { ContentMaxWidth, FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
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

  // Not a `wide` sheet: this is a column of figures read top to bottom, and a
  // wide card would leave the content stranded in the middle of it.
  return (
    <ModalSheet title="Year report">
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
          ) : (
            <View style={styles.section}>
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
                  across {report.dealsClosed} closed{' '}
                  {report.dealsClosed === 1 ? 'deal' : 'deals'} in {report.fyLabel}
                </Text>
              </Card>

              {/* Both sides, never merged. The app's figure stays visible next
                  to what she added, so she and her accountant can always see
                  which is which — §8.13. */}
              {hasAdjustments(report.adjustments) ? (
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
                    <Text style={[styles.adjustedKey, { color: c.textSecondary }]}>
                      Taxable income
                    </Text>
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
              ) : null}

              {report.totalExpenses > 0 ? (
                <View style={styles.metrics}>
                  <MetricCard
                    label="Expenses"
                    value={report.totalExpenses}
                    format={formatCurrency}
                    caption="what the work cost"
                    index={0}
                  />
                  <MetricCard
                    label="Taxable income"
                    value={report.netIncome}
                    format={formatCurrency}
                    tone="accent"
                    caption="earned minus expenses"
                    index={1}
                  />
                </View>
              ) : null}

              <View style={styles.metrics}>
                <MetricCard
                  label="GST collected"
                  value={report.gstCollected}
                  format={formatCurrency}
                  index={0}
                />
                <MetricCard
                  label="TDS deducted"
                  value={report.tdsDeducted}
                  format={formatCurrency}
                  caption="claim against 26AS"
                  index={1}
                />
              </View>

              <View style={styles.metrics}>
                <MetricCard
                  label="Payments settled"
                  value={report.paymentsResolved}
                  index={2}
                />
                <MetricCard
                  label="Deals closed"
                  value={report.dealsClosed}
                  index={3}
                />
              </View>

              {/* Placed under the figures, not above them: the app's own
                  numbers are the starting point, and this is the correction to
                  them. §8.13 — she has income and costs this never saw. */}
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

              {report.bestClient ? (
                <Card>
                  <Text style={[styles.cardLabel, { color: c.textSecondary }]}>Best client</Text>
                  <Text style={[styles.cardValue, { color: c.textPrimary }]}>
                    {report.bestClient.name}
                  </Text>
                  <Text style={[styles.cardHint, { color: c.textMuted }]}>
                    {formatCurrency(report.bestClient.total)} paid to you this year
                  </Text>
                </Card>
              ) : null}

              {report.worstClient ? (
                <Card>
                  <Text style={[styles.cardLabel, { color: c.textSecondary }]}>
                    Toughest to work with
                  </Text>
                  <Text style={[styles.cardValue, { color: c.textPrimary }]}>
                    {report.worstClient.name}
                  </Text>
                  <Text style={[styles.cardHint, { color: c.textMuted }]}>
                    You rated them {report.worstClient.averageRating.toFixed(1)} out of 5
                  </Text>
                </Card>
              ) : null}

              <Text style={[styles.footnote, { color: c.textMuted }]}>
                Indian financial year, April to March. Figures come from payments marked received
                and invoices raised inside {report.fyLabel}.
              </Text>
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
    maxWidth: ContentMaxWidth,
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
  metrics: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
