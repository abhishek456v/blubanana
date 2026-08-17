import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { getDeals, type DealWithPaymentSummary } from '@/lib/deals'
import { getInvoices } from '@/lib/invoices'
import { getAllRatings } from '@/lib/reputation'
import { getExpenses, type Expense } from '@/lib/expenses'
import { computeAnnualReport, currentFinancialYearStart } from '@/lib/annualReport'
import { formatCurrency } from '@/lib/format'
import type { BrandRating, Invoice } from '@/types'
import { ContentMaxWidth, FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { ModalSheet } from '@/components/ModalSheet'
import {
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
      setRatings(await getAllRatings())
    } catch {
      // Non-fatal: the toughest-client line just doesn't show.
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const report = useMemo(
    () => computeAnnualReport(deals, invoices, ratings, expenses, fyStartYear),
    [deals, invoices, ratings, expenses, fyStartYear]
  )

  const atCurrentYear = fyStartYear >= currentFinancialYearStart()
  const isEmpty = report.totalRevenue === 0 && report.dealsClosed === 0

  return (
    <ModalSheet title="Year in review">
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
      </SafeAreaView>
    </ModalSheet>
  )
}

const styles = StyleSheet.create({
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
