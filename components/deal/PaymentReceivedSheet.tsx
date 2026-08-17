import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency } from '@/lib/format'
import { Button, Figure, Sheet, TextField } from '@/components/ui'

export interface PaymentReceivedSheetProps {
  visible: boolean
  /** What the brand was invoiced. The figure everything else is checked against. */
  invoiced: number
  brandName: string
  saving?: boolean
  onCancel: () => void
  onConfirm: (result: { received: number; tds: number }) => void
}

/**
 * Captures what actually landed, when a payment is marked received.
 *
 * This is the one moment in the app where a wrong number is expensive and
 * silent. A brand invoiced ₹1,00,000 that withholds ₹10,000 TDS pays ₹90,000,
 * and if the app records ₹1,00,000 the bank reconciliation is wrong forever
 * and the TDS she can claim against Form 26AS is lost. So it is a deliberate,
 * blocking dialog rather than a quiet toggle: the creator's whole attention
 * should be on these two figures.
 *
 * Received and TDS are captured separately, not derived. A short payment is
 * not always TDS — a brand can underpay, deduct a penalty, or round — so the
 * gap is *offered* as TDS and can be overridden. Typing either one fills the
 * other, because a creator usually knows one of them and doing the subtraction
 * in her head is exactly the step that introduces the error.
 */
export function PaymentReceivedSheet({
  visible,
  invoiced,
  brandName,
  saving = false,
  onCancel,
  onConfirm,
}: PaymentReceivedSheetProps) {
  const { c } = useTheme()
  const [received, setReceived] = useState('')
  const [tds, setTds] = useState('')

  // Reset each time it opens. A sheet that reopens holding the last payment's
  // numbers is how the wrong figure gets confirmed by muscle memory.
  useEffect(() => {
    if (visible) {
      setReceived(String(invoiced))
      setTds('0')
    }
  }, [visible, invoiced])

  const receivedNum = Number(received.replace(/[^0-9]/g, '')) || 0
  const tdsNum = Number(tds.replace(/[^0-9]/g, '')) || 0
  const accounted = receivedNum + tdsNum
  const gap = invoiced - accounted

  const onReceivedChange = (value: string) => {
    setReceived(value)
    const next = Number(value.replace(/[^0-9]/g, '')) || 0
    // Offer the shortfall as TDS, which is what it is the overwhelming
    // majority of the time. Never go negative on an overpayment.
    setTds(String(Math.max(invoiced - next, 0)))
  }

  const onTdsChange = (value: string) => {
    setTds(value)
    const next = Number(value.replace(/[^0-9]/g, '')) || 0
    setReceived(String(Math.max(invoiced - next, 0)))
  }

  return (
    <Sheet visible={visible} onClose={onCancel} title="What actually landed?">
      <Text style={[styles.intro, { color: c.textSecondary }]}>
        {brandName} was invoiced {formatCurrency(invoiced)}. Record what reached your account,
        so your tax figures and your bank statement agree.
      </Text>

      <View style={[styles.invoicedBox, { backgroundColor: c.bgSurface, borderColor: c.border }]}>
        <Text style={[styles.invoicedLabel, { color: c.textMuted }]}>Invoiced</Text>
        <Figure value={formatCurrency(invoiced)} size="lg" color={c.textPrimary} bold />
      </View>

      <View style={styles.fields}>
        <TextField
          label="Received"
          value={received}
          onChangeText={onReceivedChange}
          keyboardType="number-pad"
          placeholder="0"
        />
        <TextField
          label="TDS withheld"
          value={tds}
          onChangeText={onTdsChange}
          keyboardType="number-pad"
          placeholder="0"
          hint="Claim this against Form 26AS at tax time"
        />
      </View>

      {/* States whether the two figures add up, rather than silently accepting
          a total that does not match the invoice. Not a blocker: brands do
          underpay, and refusing to record reality is worse than flagging it. */}
      <View style={styles.reconcile}>
        {gap === 0 ? (
          <Text style={[styles.reconcileOk, { color: c.success }]}>
            Adds up to the invoiced amount.
          </Text>
        ) : gap > 0 ? (
          <Text style={[styles.reconcileWarn, { color: c.warning }]}>
            {formatCurrency(gap)} unaccounted for. Short-paid, or is some of it still to come?
          </Text>
        ) : (
          <Text style={[styles.reconcileWarn, { color: c.warning }]}>
            {formatCurrency(Math.abs(gap))} more than invoiced.
          </Text>
        )}
      </View>

      <Button
        label={saving ? 'Saving…' : 'Mark received'}
        onPress={() => onConfirm({ received: receivedNum, tds: tdsNum })}
        disabled={saving}
        fullWidth
      />
      <Button label="Cancel" variant="ghost" onPress={onCancel} fullWidth style={styles.cancel} />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  intro: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    marginBottom: Spacing.lg,
    lineHeight: 21,
  },
  invoicedBox: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xxs,
    marginBottom: Spacing.md,
  },
  invoicedLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  fields: {
    gap: Spacing.md,
  },
  reconcile: {
    marginTop: Spacing.base,
    marginBottom: Spacing.lg,
  },
  reconcileOk: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  reconcileWarn: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  cancel: {
    marginTop: Spacing.sm,
  },
})
