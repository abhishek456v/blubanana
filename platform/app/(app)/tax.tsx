import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { getDeals, paymentsInOrder, type DealWithPaymentSummary } from '@/lib/deals'
import { getExpenses, type Expense } from '@/lib/expenses'
import { advanceTaxSchedule, estimateTax, financialYearStart } from '@/lib/tax'
import { formatCurrency, formatDate, toDateString } from '@/lib/format'
import { Elevation, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { ModalSheet } from '@/components/ModalSheet'
import { Figure, RevealScrollView, Skeleton, TextField, useToast } from '@/components/ui'

/**
 * Advance tax, worked out from her own numbers.
 *
 * Indian freelancers pay advance tax in four instalments and most find out
 * from their CA in March, by which point sections 234B and 234C have already
 * added interest. The app knows what she earned and what she spent, so it can
 * do the arithmetic. It deliberately does not guess her rate.
 *
 * Two reasons for that, and the second is the important one. Slab rates change
 * most budgets, so a hardcoded table goes stale and produces a confident wrong
 * answer. And the app only sees the income that passed through it: salary,
 * interest, or another business it never saw would all be missing. A figure
 * she supplies is honest about whose number it is; one the app invented would
 * not be.
 *
 * Laid out in two columns on a desktop: what she earned and what she tells the
 * app on the left, the four dates on the right. Those are two different
 * questions, and stacking them meant the schedule, which is the entire reason
 * to open this screen, started below the fold.
 */
export default function TaxScreen() {
  const { c, isDark } = useTheme()
  const { isDesktop } = useBreakpoint()
  const toast = useToast()

  const [deals, setDeals] = useState<DealWithPaymentSummary[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [rate, setRate] = useState('30')
  const [otherIncome, setOtherIncome] = useState('')

  const load = useCallback(async () => {
    try {
      const [dealData, expenseData] = await Promise.all([getDeals(), getExpenses()])
      setDeals(dealData)
      setExpenses(expenseData)
    } catch {
      toast('Could not load your figures', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const fyStart = financialYearStart()
  const fyFrom = `${fyStart}-04-01`
  const fyTo = `${fyStart + 1}-03-31`

  const figures = useMemo(() => {
    // Received, not invoiced. Advance tax is due on income actually earned,
    // and an invoice a brand is sitting on is not income yet.
    const received = deals
      .flatMap((deal) => paymentsInOrder(deal))
      .filter(
        (payment) =>
          payment.status === 'paid' &&
          payment.paid_date &&
          payment.paid_date >= fyFrom &&
          payment.paid_date <= fyTo
      )
      .reduce((sum, payment) => sum + (payment.amount_received ?? payment.amount), 0)

    const spent = expenses
      .filter((expense) => expense.spent_on >= fyFrom && expense.spent_on <= fyTo)
      .reduce((sum, expense) => sum + expense.amount, 0)

    const other = Number(otherIncome.replace(/[^0-9]/g, '')) || 0
    return { received, spent, other, net: Math.max(received + other - spent, 0) }
  }, [deals, expenses, otherIncome, fyFrom, fyTo])

  const ratePercent = Math.min(Math.max(Number(rate.replace(/[^0-9.]/g, '')) || 0, 0), 100)
  const expectedTax = estimateTax(figures.net, ratePercent)
  const schedule = useMemo(
    () => advanceTaxSchedule(expectedTax, fyStart),
    [expectedTax, fyStart]
  )

  // The first instalment still ahead of her. It is the only row that carries a
  // question, so it is the only one that gets lifted off the panel.
  const nextIndex = schedule.findIndex((instalment) => !instalment.isPast)

  const incomeCard = (
    <View style={[styles.card, { backgroundColor: c.bgSurface }]}>
      <Text style={[styles.label, { color: c.textSecondary }]}>
        Taxable income · FY {fyStart}-{String(fyStart + 1).slice(2)}
      </Text>
      <Figure value={formatCurrency(figures.net)} size="hero" color={c.textPrimary} bold />
      <View style={styles.breakdown}>
        <Row label="Received through Blubanana" value={figures.received} c={c} />
        {figures.other > 0 ? (
          <Row label="Other income you added" value={figures.other} c={c} />
        ) : null}
        <Row label="Expenses" value={-figures.spent} c={c} />
      </View>
    </View>
  )

  const inputs = (
    <>
      <TextField
        label="Other income this year"
        value={otherIncome}
        onChangeText={setOtherIncome}
        keyboardType="number-pad"
        placeholder="0"
        hint="Salary, interest, anything Blubanana never saw"
      />
      <TextField
        label="Your effective tax rate (%)"
        value={rate}
        onChangeText={setRate}
        keyboardType="decimal-pad"
        placeholder="30"
        hint="Ask your CA. Rates change every budget, so this app will not guess one for you."
      />
    </>
  )

  const expectedCard = (
    <View style={[styles.card, styles.expected, { backgroundColor: c.accentLight }]}>
      <Text style={[styles.label, { color: c.accentText }]}>Expected tax</Text>
      <Figure value={formatCurrency(expectedTax)} size="lg" color={c.accentText} bold />
    </View>
  )

  const scheduleBlock = (
    <>
      <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
        What to set aside, and by when
      </Text>
      <View style={styles.schedule}>
        {schedule.map((instalment, index) => {
          const isNext = index === nextIndex
          return (
            <View
              key={instalment.label}
              style={[
                styles.instalment,
                { backgroundColor: isNext ? c.bgSurfaceRaised : c.bgSurface },
                // Fill and shadow, never an outline (20 Aug redesign, round
                // three). The one row that still needs an answer lifts; the
                // rest sit flat on the panel.
                isNext && (isDark ? Elevation.dark : Elevation.light).sm,
              ]}
            >
              {isNext ? <View style={[styles.marker, { backgroundColor: c.accent }]} /> : null}
              <View style={styles.instalmentText}>
                <Text
                  style={[
                    styles.instalmentDate,
                    { color: instalment.isPast ? c.textMuted : c.textPrimary },
                  ]}
                >
                  {instalment.label}
                </Text>
                <Text style={[styles.instalmentMeta, { color: c.textMuted }]}>
                  {/* toDateString, not toISOString: the latter converts to
                      UTC, and midnight IST is 18:30 UTC the previous day, so
                      every instalment displayed a date one day early. On a
                      statutory deadline that is not cosmetic. */}
                  {instalment.isPast
                    ? 'Passed'
                    : `Due ${formatDate(toDateString(instalment.dueOn))}`}
                  {' · '}
                  {Math.round((instalment.cumulative / Math.max(expectedTax, 1)) * 100)}%
                  cumulative
                </Text>
              </View>
              <Figure
                value={formatCurrency(instalment.thisInstalment)}
                size="sm"
                color={instalment.isPast ? c.textMuted : c.textPrimary}
              />
            </View>
          )
        })}
      </View>
      <Text style={[styles.footnote, { color: c.textMuted }]}>
        Instalment percentages are set by section 211 and do not change. Missing one attracts
        interest under sections 234B and 234C. This is an estimate to set money aside against,
        not a filing.
      </Text>
    </>
  )

  return (
    <ModalSheet title="Advance tax" wide>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <RevealScrollView
          contentContainerStyle={[styles.content, isDesktop && styles.contentWide]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <Skeleton height={160} radius={Radius.lg} />
          ) : isDesktop ? (
            <View style={styles.columns}>
              <View style={styles.column}>
                {incomeCard}
                {inputs}
                {expectedCard}
              </View>
              <View style={styles.column}>{scheduleBlock}</View>
            </View>
          ) : (
            <>
              {incomeCard}
              {inputs}
              {expectedCard}
              {scheduleBlock}
            </>
          )}
        </RevealScrollView>
      </SafeAreaView>
    </ModalSheet>
  )
}

function Row({
  label,
  value,
  c,
}: {
  label: string
  value: number
  c: { textMuted: string; textSecondary: string }
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: c.textMuted }]}>
        {/* `value < 0` is false for -0, which rendered as "₹-0". */}
        {value < 0 ? `− ${formatCurrency(Math.abs(value))}` : formatCurrency(Math.abs(value))}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    width: '100%',
    alignSelf: 'center',
  },
  // The sheet already caps the width, so the content fills it rather than
  // adding a second, narrower cap inside the first.
  contentWide: {
    padding: Spacing.lg,
  },
  columns: {
    flexDirection: 'row',
    gap: Spacing.lg,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    gap: Spacing.md,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  expected: {
    // Royal blue tint rather than another grey panel: this is the number the
    // whole screen exists to produce, and on a two-column layout it otherwise
    // reads as the third identical box in the left stack.
    gap: Spacing.xxs,
  },
  label: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  breakdown: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    flex: 1,
  },
  rowValue: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  sectionTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  schedule: {
    gap: Spacing.sm,
  },
  instalment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
    overflow: 'hidden',
  },
  // A three-pixel royal blue edge, inside the radius. Says "this one" without
  // drawing a rectangle around it.
  marker: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  instalmentText: {
    flex: 1,
    gap: 2,
  },
  instalmentDate: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  instalmentMeta: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  footnote: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
})
