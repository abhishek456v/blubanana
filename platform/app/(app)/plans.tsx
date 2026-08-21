import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import {
  GST_PERCENT,
  effectiveMonthlyRupees,
  getPricing,
  getTerms,
  introPlacesLeft,
  rupeesOf,
  termPricePaise,
  withGst,
  type Pricing,
  type Term,
} from '@/lib/subscription'
import { PaymentsNotConfigured, startCheckout } from '@/lib/billing'
import { useFeatureFlag } from '@/hooks/useFeatureFlags'
import { useEntitlement } from '@/hooks/useEntitlement'
import { Elevation, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { ModalSheet } from '@/components/ModalSheet'
import {
  Button,
  Card,
  PressableScale,
  RevealScrollView,
  Skeleton,
  useToast,
} from '@/components/ui'

const INCLUDED = [
  'Every feature, with nothing held back',
  'Up to 5 people in your workspace',
  'Unlimited deals, brands, invoices and expenses',
  'Deadline and payment reminders',
  'GST invoices, TDS and the advance-tax calculator',
  'Your rate card, and export whenever you want',
]

function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

/**
 * The plan screen (§3).
 *
 * One plan and a choice of term, so the decision is "how long", never "which
 * features". Everything shown here is computed from `pricing` in the database
 * rather than typed in — a price change is a row, not a release, and the
 * struck-through figure cannot drift from the one that gets charged.
 */
export default function PlansScreen() {
  const { c, isDark } = useTheme()
  const { isDesktop } = useBreakpoint()
  const toast = useToast()
  const entitlement = useEntitlement()

  const [pricing, setPricing] = useState<Pricing | null>(null)
  const [terms, setTerms] = useState<Term[]>([])
  const [placesLeft, setPlacesLeft] = useState<number | null>(null)
  const [selected, setSelected] = useState<Term['key']>('yearly')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const paymentsOn = useFeatureFlag('payments')

  const load = useCallback(async () => {
    try {
      const [price, termList] = await Promise.all([getPricing(), getTerms()])
      setPricing(price)
      setTerms(termList)
      setPlacesLeft(await introPlacesLeft(price))
    } catch {
      toast('Could not load the plans', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  if (loading || !pricing) {
    return (
      <ModalSheet title="Plans" wide>
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.content}>
            <Skeleton height={200} radius={Radius.lg} />
          </View>
        </SafeAreaView>
      </ModalSheet>
    )
  }

  // The offer is live only while places remain. Once it closes the list price
  // is simply the price, and nothing on this screen is struck through — which
  // is the point of counting rather than announcing.
  const introLive = (placesLeft ?? 0) > 0
  const term = terms.find((t) => t.key === selected) ?? terms[0]

  /**
   * Opens Razorpay, then re-reads rather than assuming.
   *
   * The browser closing says nothing: she may have approved, abandoned, or shut
   * the tab. Only the webhook knows, and it may land a moment later — so the
   * entitlement is refreshed on return and the banner updates itself when it
   * does.
   */
  async function handleSubscribe() {
    if (!term || starting) return
    setStarting(true)
    try {
      await startCheckout(term.key)
      entitlement.refresh()
      await load()
    } catch (error) {
      toast(
        error instanceof PaymentsNotConfigured
          ? 'Payments are not switched on yet. Nothing has been charged.'
          : 'Could not open the payment page',
        { tone: error instanceof PaymentsNotConfigured ? 'warning' : 'error' }
      )
    } finally {
      setStarting(false)
    }
  }

  const banner = (
    <>
      {introLive ? (
        <View style={[styles.offer, { backgroundColor: c.accentLight }]}>
          <Ionicons name="sparkles" size={15} color={c.accent} />
          <Text style={[styles.offerText, { color: c.accentText }]}>
            Launch offer · {pricing.introDiscountPercent}% off ·{' '}
            {placesLeft} of {pricing.introCustomerLimit} places left
          </Text>
        </View>
      ) : null}

      {entitlement.isTrialing ? (
        <Text style={[styles.trialLine, { color: c.textSecondary }]}>
          {entitlement.trialDaysLeft}{' '}
          {entitlement.trialDaysLeft === 1 ? 'day' : 'days'} left in your trial.
        </Text>
      ) : null}
    </>
  )

  const termList = (
  <View style={styles.terms}>
    {terms.map((option) => {
      const isOn = option.key === selected
      const perMonth = effectiveMonthlyRupees(pricing, option, introLive)
      return (
        <PressableScale
          key={option.key}
          onPress={() => setSelected(option.key)}
          accessibilityRole="radio"
          accessibilityState={{ selected: isOn }}
          accessibilityLabel={`${option.label}, ${inr(perMonth)} a month`}
          style={[
            styles.term,
            { backgroundColor: isOn ? c.accentLight : c.bgSurface },
            isOn && (isDark ? Elevation.dark : Elevation.light).sm,
          ]}
        >
          <View
            style={[
              styles.radio,
              { backgroundColor: isOn ? c.accent : c.borderStrong },
            ]}
          >
            {isOn ? <Ionicons name="checkmark" size={12} color={c.onFillPrimary} /> : null}
          </View>
          <View style={styles.termText}>
            <Text style={[styles.termLabel, { color: c.textPrimary }]}>
              {option.label}
            </Text>
            <Text style={[styles.termMeta, { color: c.textMuted }]}>
              {inr(perMonth)} a month
              {option.months > 1 && option.termMultiplier < option.months
                ? ` · saves ${Math.round(((option.months - option.termMultiplier) / option.months) * 100)}%`
                : ''}
            </Text>
          </View>
          <View style={styles.termPrices}>
            {introLive ? (
              <Text style={[styles.strike, { color: c.textMuted }]}>
                {inr(rupeesOf(termPricePaise(pricing, option, false)))}
              </Text>
            ) : null}
            <Text style={[styles.termPrice, { color: c.textPrimary }]}>
              {inr(rupeesOf(termPricePaise(pricing, option, introLive)))}
            </Text>
          </View>
        </PressableScale>
      )
    })}
  </View>
  )

  const checkout = (
    <>
      {term ? (
        <Card style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryKey, { color: c.textSecondary }]}>
              {term.label}
            </Text>
            <Text style={[styles.summaryValue, { color: c.textPrimary }]}>
              {inr(rupeesOf(termPricePaise(pricing, term, introLive)))}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryKey, { color: c.textSecondary }]}>
              GST at {GST_PERCENT}%
            </Text>
            <Text style={[styles.summaryValue, { color: c.textPrimary }]}>
              {inr(
                withGst(rupeesOf(termPricePaise(pricing, term, introLive))) -
                  rupeesOf(termPricePaise(pricing, term, introLive))
              )}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: c.border }]}>
            <Text style={[styles.summaryKey, { color: c.textPrimary }]}>Total today</Text>
            <Text style={[styles.summaryTotalValue, { color: c.textPrimary }]}>
              {inr(withGst(rupeesOf(termPricePaise(pricing, term, introLive))))}
            </Text>
          </View>
        </Card>
      ) : null}

      <Card style={styles.included}>
        <Text style={[styles.includedLabel, { color: c.textSecondary }]}>What you get</Text>
        {INCLUDED.map((line) => (
          <View key={line} style={styles.includedRow}>
            <Ionicons name="checkmark" size={15} color={c.accent} />
            <Text style={[styles.includedText, { color: c.textPrimary }]}>{line}</Text>
          </View>
        ))}
      </Card>

      {/* The switch, thrown from the dashboard. Razorpay having a bad hour
          should take the button away rather than leave people pressing it and
          meeting an error, and that decision should not need a release. */}
      {paymentsOn ? (
        <>
          <Button
            label={starting ? 'Opening…' : 'Subscribe'}
            onPress={handleSubscribe}
            disabled={starting || !term}
            fullWidth
          />
          <Text style={[styles.note, { color: c.textMuted }]}>
            Card, UPI and netbanking through Razorpay. Your price holds for the whole
            term you buy; renewal is at whatever the price is then.
          </Text>
        </>
      ) : (
        <Text style={[styles.note, { color: c.textMuted }]}>
          Subscribing is switched off for a short while. Nothing changes about your
          workspace in the meantime, and we will let you know as soon as it is back.
        </Text>
      )}
    </>
  )

  return (
    <ModalSheet title="Plans" wide>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <RevealScrollView
          contentContainerStyle={[styles.content, isDesktop && styles.contentWide]}
          showsVerticalScrollIndicator={false}
        >
          {banner}
          {isDesktop ? (
            // Choosing a term and seeing what it costs are one decision. Stacked,
            // picking "12 months" scrolled the total out of view, which is the
            // one number the choice is being made against.
            <View style={styles.columns}>
              <View style={styles.column}>
                <Text style={[styles.columnTitle, { color: c.textPrimary }]}>
                  How long you want to pay for
                </Text>
                {termList}
              </View>
              <View style={styles.column}>{checkout}</View>
            </View>
          ) : (
            <>
              {termList}
              {checkout}
            </>
          )}
        </RevealScrollView>
      </SafeAreaView>
    </ModalSheet>
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
  columnTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  offerText: {
    ...Typography.caption,
    fontFamily: FontFamily.semiBold,
    flexShrink: 1,
  },
  trialLine: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  terms: { gap: Spacing.sm },
  term: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  // The selection indicator, since the outline is gone: a filled disc that
  // takes a tick when chosen.
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termText: { flex: 1, gap: 2 },
  termLabel: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  termMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  termPrices: { alignItems: 'flex-end', gap: 1 },
  strike: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    textDecorationLine: 'line-through',
  },
  termPrice: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  summary: { gap: Spacing.xs },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  summaryTotal: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  summaryKey: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  summaryValue: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  summaryTotalValue: {
    ...Typography.title,
    fontFamily: FontFamily.semiBold,
  },
  included: { gap: Spacing.xs },
  includedLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.xs,
  },
  includedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  includedText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    flex: 1,
    lineHeight: 21,
  },
  note: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
})
