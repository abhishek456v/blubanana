import { View, Text, StyleSheet, useColorScheme } from 'react-native'
import type { PaymentStatus } from '@/types'
import { Colors, Typography, FontFamily, Spacing, Radius } from '@/constants/design'
import { PAYMENT_STATUS_LABELS } from '@/constants/labels'

// Per DESIGN.md: status without color. Mirrors StatusPill's variant pattern
// but kept separate since it's typed to PaymentStatus, not DealStatus —
// each component keeps one responsibility.
// urgent   → filled dark pill (overdue)
// complete → muted text + checkmark (paid)
// normal   → outline pill (pending, reminder_sent)
type PillVariant = 'normal' | 'urgent' | 'complete'

function getVariant(status: PaymentStatus): PillVariant {
  if (status === 'paid') return 'complete'
  if (status === 'overdue') return 'urgent'
  return 'normal'
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const variant = getVariant(status)
  const label = PAYMENT_STATUS_LABELS[status]

  if (variant === 'complete') {
    return (
      <View style={styles.pill}>
        <Text style={[styles.text, { color: c.textMuted, fontFamily: FontFamily.regular }]}>
          ✓ {label}
        </Text>
      </View>
    )
  }

  if (variant === 'urgent') {
    return (
      <View style={[styles.pill, { backgroundColor: c.fillPrimary }]}>
        <Text style={[styles.text, { color: c.onFillPrimary, fontFamily: FontFamily.medium }]}>
          {label}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.pill, styles.outline, { borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.textSecondary, fontFamily: FontFamily.regular }]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  outline: {
    borderWidth: 1,
  },
  text: {
    ...Typography.label,
  },
})
