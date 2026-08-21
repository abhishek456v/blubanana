import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/core'
import { getPricing, savePricing, type BillingTerm, type Pricing } from '@/lib/admin'
import { formatCurrency } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { Button, Card, MetricCard, TextField, useConfirm, useToast } from '@/components/ui'

/** Paise in, rupees on screen. This table is the only one in paise. */
const toRupees = (paise: number) => Math.round(paise / 100)

/**
 * What everybody pays.
 *
 * These two tables already drive the public pricing page: the website reads
 * them at runtime, so a change here is on blubanana.in within seconds without
 * a deploy. That makes this the most powerful screen in the dashboard and the
 * one most worth being careful on, which is why every figure is bounded on the
 * server and every change is confirmed here first.
 */
export default function AdminPricing() {
  const { c } = useTheme()
  const toast = useToast()
  const confirm = useConfirm()

  const [pricing, setPricing] = useState<Pricing | null>(null)
  const [terms, setTerms] = useState<BillingTerm[]>([])
  const [taken, setTaken] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [monthly, setMonthly] = useState('')
  const [yearly, setYearly] = useState('')
  const [intro, setIntro] = useState('')
  const [places, setPlaces] = useState('')
  const [seats, setSeats] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await getPricing()
      setPricing(data.pricing)
      setTerms(data.terms)
      setTaken(data.introSeatsTaken)
      setMonthly(String(toRupees(data.pricing.list_monthly_paise)))
      setYearly(String(data.pricing.yearly_discount_percent))
      setIntro(String(data.pricing.intro_discount_percent))
      setPlaces(String(data.pricing.intro_customer_limit))
      setSeats(String(data.pricing.seats))
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load the price list', {
        tone: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const introPrice = Number(monthly) * (1 - Number(intro) / 100)
  const yearlyPerMonth = Number(monthly) * (1 - Number(yearly) / 100)

  const save = async () => {
    const ok = await confirm({
      title: 'Change what everybody pays?',
      message: `The public pricing page updates within seconds. New subscriptions would be charged ${formatCurrency(
        Math.round(Number(monthly))
      )} a month, or ${formatCurrency(Math.round(introPrice))} for an intro place.`,
      confirmLabel: 'Change it',
      destructive: true,
    })
    if (!ok) return

    setSaving(true)
    try {
      await savePricing({
        list_monthly_paise: Math.round(Number(monthly) * 100),
        yearly_discount_percent: Number(yearly),
        intro_discount_percent: Number(intro),
        intro_customer_limit: Number(places),
        seats: Number(seats),
      })
      toast('Changed. The public page is already showing it.')
      load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not save', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const left = Math.max(Number(places) - taken, 0)

  return (
    <AdminScreen
      title="Price"
      hint="What everybody pays. The public page reads this live, so a change here is visible on the website within seconds."
      loading={loading}
    >
      {!pricing ? null : (
        <>
          <View style={styles.metrics}>
            <View style={styles.cell}>
              <MetricCard
                label="Everyone pays"
                value={toRupees(pricing.list_monthly_paise)}
                format={formatCurrency}
                caption="a month, at the list price"
                index={0}
              />
            </View>
            <View style={styles.cell}>
              <MetricCard
                label="Intro places taken"
                value={taken}
                caption={`${left} still open`}
                tone="accent"
                index={1}
              />
            </View>
          </View>

          <Card>
            <View style={styles.form}>
              <TextField
                label="Monthly price, in rupees"
                value={monthly}
                onChangeText={(v) => setMonthly(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                prefix="₹"
                hint="Between ₹99 and ₹9,999. The server refuses anything outside that, so a slipped zero is a refusal rather than an apology."
              />
              <TextField
                label="Intro discount, as a percentage"
                value={intro}
                onChangeText={(v) => setIntro(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                hint={`An intro place costs ${formatCurrency(Math.round(introPrice))} a month.`}
              />
              <TextField
                label="How many intro places"
                value={places}
                onChangeText={(v) => setPlaces(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                hint={`${taken} taken, ${left} left. The public page counts down from this.`}
              />
              <TextField
                label="Yearly discount, as a percentage"
                value={yearly}
                onChangeText={(v) => setYearly(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                hint={`Paying for a year works out at ${formatCurrency(
                  Math.round(yearlyPerMonth)
                )} a month.`}
              />
              <TextField
                label="Seats included"
                value={seats}
                onChangeText={(v) => setSeats(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                hint="How many people a creator may invite to their workspace."
              />
              <Button
                label={saving ? 'Saving' : 'Change the price'}
                onPress={save}
                disabled={saving}
                fullWidth
              />
            </View>
          </Card>

          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Terms on offer</Text>
          <Card>
            {terms.map((term) => (
              // The label already says the length: printing months again gave
              // "3 months · 3 months".
              <Text key={term.key} style={[styles.term, { color: c.textSecondary }]}>
                {term.label} ·{' '}
                {formatCurrency(
                  Math.round(toRupees(pricing.list_monthly_paise) * Number(term.term_multiplier))
                )}{' '}
                at the list price
              </Text>
            ))}
            <Text style={[styles.note, { color: c.textMuted }]}>
              Terms are set in the database rather than here. Adding or removing one changes what
              the checkout offers, which is a bigger decision than a price.
            </Text>
          </Card>
        </>
      )}
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'flex-start' },
  cell: { flexGrow: 1, flexBasis: 190 },
  form: { gap: Spacing.md },
  sectionTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
    marginTop: Spacing.sm,
  },
  term: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 22 },
  note: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
    lineHeight: 17,
    marginTop: Spacing.sm,
  },
})
