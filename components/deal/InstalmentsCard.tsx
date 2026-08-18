import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency, formatDate } from '@/lib/format'
import { getPaymentAlertTone } from '@/lib/paymentReminders'
import type { Payment } from '@/types'
import { Button, DateField, Figure, PressableScale, TextField } from '@/components/ui'
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge'

export interface InstalmentsCardProps {
  payments: Payment[]
  /** Total agreed on the deal, for the "adds up?" check. */
  /** Null when withheld from this reader — see `Deal.rate`. The reconciliation
   *  line below is then omitted rather than computed against a missing total. */
  dealRate: number | null
  onAdd: (input: { amount: number; due_date: string | null; label: string }) => Promise<void>
  onRemove: (paymentId: string) => void
  onMarkReceived: (payment: Payment) => void
  busy?: boolean
}

/**
 * The deal's payment schedule.
 *
 * Most deals have one row and look exactly as they always did. The card earns
 * its place on the ones that do not: "50% advance, 50% on delivery" is the
 * most common arrangement in Indian creator work, and until migration 021 a
 * deal could only hold one payment, so creators either lost the advance or
 * logged two deals for one job.
 *
 * Each instalment settles on its own, because that is what actually happens:
 * the advance lands in March and the balance in June, each with its own TDS.
 */
export function InstalmentsCard({
  payments,
  dealRate,
  onAdd,
  onRemove,
  onMarkReceived,
  busy = false,
}: InstalmentsCardProps) {
  const { c } = useTheme()
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [dueDate, setDueDate] = useState<string | null>(null)

  const scheduled = payments.reduce((sum, payment) => sum + payment.amount, 0)
  // Null, not zero: with the deal total withheld there is no gap to state, and
  // zero would assert the schedule adds up exactly — which it might not.
  const gap = dealRate === null ? null : dealRate - scheduled

  const reset = () => {
    setAdding(false)
    setAmount('')
    setLabel('')
    setDueDate(null)
  }

  const submit = async () => {
    const value = Number(amount.replace(/[^0-9]/g, '')) || 0
    if (value <= 0) return
    await onAdd({ amount: value, due_date: dueDate, label: label.trim() })
    reset()
  }

  return (
    <View style={[styles.card, { backgroundColor: c.bgSurface }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.textPrimary }]}>
          {payments.length > 1 ? 'Payment schedule' : 'Payment'}
        </Text>
        {payments.length > 1 ? (
          <Text style={[styles.headMeta, { color: c.textMuted }]}>
            {payments.filter((p) => p.status === 'paid').length} of {payments.length} settled
          </Text>
        ) : null}
      </View>

      <View style={styles.rows}>
        {payments.map((payment) => {
          const overdue = payment.status !== 'paid' && getPaymentAlertTone(payment) === 'overdue'
          const settled = payment.status === 'paid'

          return (
            <Animated.View
              key={payment.id}
              entering={FadeIn.duration(Duration.fast)}
              exiting={FadeOut.duration(Duration.fast)}
              layout={Layout.duration(Duration.base)}
              style={[styles.row, { borderColor: c.border }]}
            >
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Figure
                    value={formatCurrency(payment.amount)}
                    size="md"
                    color={c.textPrimary}
                    bold
                  />
                  <PaymentStatusBadge status={payment.status} />
                </View>

                <Text style={[styles.rowMeta, { color: overdue ? c.danger : c.textMuted }]}>
                  {[
                    payment.label || null,
                    payment.due_date ? `Due ${formatDate(payment.due_date)}` : null,
                    // Only shown once settled, and only when it differs: on a
                    // payment that arrived in full this line would be noise.
                    settled && payment.amount_received != null &&
                    payment.amount_received !== payment.amount
                      ? `${formatCurrency(payment.amount_received)} received, ${formatCurrency(payment.tds_amount)} TDS`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>

              {settled ? null : (
                <View style={styles.rowActions}>
                  <PressableScale
                    onPress={() => onMarkReceived(payment)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${formatCurrency(payment.amount)} received`}
                    style={[styles.receiveButton, { borderColor: c.borderStrong }]}
                  >
                    <Text style={[styles.receiveText, { color: c.textPrimary }]}>Received</Text>
                  </PressableScale>

                  {/* Removing is only offered while several exist. Deleting the
                      last payment would leave a deal with a rate and no way to
                      ever be paid, which is not a state worth reaching. */}
                  {payments.length > 1 ? (
                    <PressableScale
                      onPress={() => onRemove(payment.id)}
                      disabled={busy}
                      hitSlop={HitSlop}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove this instalment`}
                    >
                      <Ionicons name="close" size={17} color={c.textMuted} />
                    </PressableScale>
                  ) : null}
                </View>
              )}
            </Animated.View>
          )
        })}
      </View>

      {adding ? (
        <Animated.View entering={FadeIn.duration(Duration.fast)} style={styles.form}>
          <TextField
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="0"
          />
          <TextField
            label="What for"
            value={label}
            onChangeText={setLabel}
            placeholder="Advance"
          />
          <DateField label="Due" value={dueDate} onChange={setDueDate} />
          <Button label="Add instalment" onPress={submit} disabled={busy} fullWidth />
          <Button label="Cancel" variant="ghost" onPress={reset} fullWidth />
        </Animated.View>
      ) : (
        <PressableScale
          onPress={() => setAdding(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Add an instalment"
          style={[styles.add, { borderColor: c.borderStrong }]}
        >
          <Ionicons name="add" size={17} color={c.accent} />
          <Text style={[styles.addText, { color: c.accentText }]}>Add instalment</Text>
        </PressableScale>
      )}

      {/* The schedule should add up to what was agreed. Stated rather than
          enforced: a deal can legitimately be part-invoiced, and blocking the
          save would stop her recording the advance before the balance exists. */}
      {gap !== null && gap !== 0 && payments.length > 0 ? (
        <Text style={[styles.gap, { color: c.textMuted }]}>
          {gap > 0
            ? `${formatCurrency(gap)} of the ${formatCurrency(dealRate)} deal is not scheduled yet.`
            : `Scheduled ${formatCurrency(Math.abs(gap))} more than the ${formatCurrency(dealRate)} deal.`}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.base,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  headMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  rows: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    borderTopWidth: 1,
    paddingTop: Spacing.base,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  receiveButton: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  receiveText: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  form: {
    gap: Spacing.base,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
  },
  addText: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  gap: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
})
