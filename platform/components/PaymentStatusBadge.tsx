import { View, Text, StyleSheet } from 'react-native'
import type { PaymentStatus } from '@/types'
import { Typography, FontFamily, Spacing, Radius } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { PAYMENT_STATUS_LABELS } from '@/constants/labels'

// Mirrors StatusPill's variant pattern but kept separate since it's typed to
// PaymentStatus, not DealStatus; each component keeps one responsibility.
// neutral → pending, nothing sent yet
// warning → reminder_sent, nudged but not yet paid
// danger  → overdue
// success → paid
type PillVariant = 'neutral' | 'warning' | 'danger' | 'success'

function getVariant(status: PaymentStatus): PillVariant {
  switch (status) {
    case 'paid':
      return 'success'
    case 'overdue':
      return 'danger'
    case 'reminder_sent':
      return 'warning'
    case 'pending':
      return 'neutral'
  }
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { c } = useTheme()
  const variant = getVariant(status)
  const label = PAYMENT_STATUS_LABELS[status]

  if (variant === 'neutral') {
    return (
      <View style={[styles.pill, styles.outline, { borderColor: c.border }]}>
        <Text style={[styles.text, { color: c.textSecondary, fontFamily: FontFamily.regular }]}>
          {label}
        </Text>
      </View>
    )
  }

  const tone =
    variant === 'success'
      ? { fg: c.success, bg: c.successLight }
      : variant === 'danger'
        ? { fg: c.danger, bg: c.dangerLight }
        : { fg: c.warning, bg: c.warningLight }

  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      {variant === 'success' ? (
        <Text style={[styles.text, { color: tone.fg, fontFamily: FontFamily.medium }]}>
          ✓ {label}
        </Text>
      ) : (
        <>
          <View style={[styles.dot, { backgroundColor: tone.fg }]} />
          <Text style={[styles.text, { color: tone.fg, fontFamily: FontFamily.medium }]}>
            {label}
          </Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  outline: {
    borderWidth: 1,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
})
