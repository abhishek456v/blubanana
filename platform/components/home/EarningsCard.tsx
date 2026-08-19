import { StyleSheet, Text, View } from 'react-native'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { formatCurrency } from '@/lib/format'
import { CircleButton, DotGrid, Figure, FigureBlock, GradientCard } from '@/components/ui'

export interface EarningsCardProps {
  /** Payments actually received across the window `monthly` covers. */
  received: number
  /** How many payments made up that total. */
  count: number
  /** Oldest → newest. Drives the dot matrix. */
  monthly: readonly { label: string; total: number }[]
  onPress: () => void
}

/**
 * Money that has actually arrived, and its shape over six months.
 *
 * Received, not billed. The distinction is the point of the card: a creator's
 * invoices and a creator's bank balance are 45 to 90 days apart, and a
 * dashboard that reports the first as though it were the second is telling her
 * she has money she cannot spend.
 *
 * The total sits at the bottom rather than the top, under the matrix that
 * explains it, so the card reads as a derivation rather than an announcement.
 */
export function EarningsCard({ received, count, monthly, onPress }: EarningsCardProps) {
  // The matrix is a comparison across months, so the newest is the one the
  // total refers to and the only one worth marking.
  const latest = monthly.length - 1

  return (
    <GradientCard
      gradient="magenta"
      title="Received"
      onPress={onPress}
      accessibilityLabel={`Received ${formatCurrency(received)} across ${count} payments.`}
      // The whole card is the tap target, so the disc is a plain one: nesting
      // a pressable inside a pressable is invalid HTML on web.
      action={<CircleButton icon="arrow-forward" iconRotate={-45} accessibilityLabel="Open Money" />}
      style={styles.fill}
    >
      <View style={styles.row}>
        <View style={styles.countRow}>
          <Figure value={String(count)} size="lg" color="#FFFFFF" />
          <Text style={styles.countWord}>{count === 1 ? 'payment' : 'payments'}</Text>
        </View>

        <View style={styles.legend}>
          <LegendItem label="Received" filled />
          <LegendItem label="Quiet month" />
        </View>
      </View>

      <DotGrid
        values={monthly.map((month) => month.total)}
        activeIndex={latest >= 0 ? latest : null}
        style={styles.grid}
      />

      <View style={styles.months}>
        {monthly.map((month, index) => (
          <Text
            key={month.label}
            style={[styles.month, index === latest && styles.monthActive]}
            numberOfLines={1}
          >
            {month.label}
          </Text>
        ))}
      </View>

      <FigureBlock
        label="in the last six months"
        reverse
        labelColor="rgba(255,255,255,0.60)"
        figure={<Figure value={formatCurrency(received)} size="hero" color="#FFFFFF" bold />}
        style={styles.total}
      />
    </GradientCard>
  )
}

function LegendItem({ label, filled = false }: { label: string; filled?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          filled
            ? { backgroundColor: '#FFFFFF' }
            : { borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  countWord: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.62)',
  },
  legend: {
    gap: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },
  legendLabel: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.62)',
  },
  grid: {
    marginTop: Spacing.xl,
  },
  months: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.base,
  },
  month: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    // Matches DotGrid's column width so the labels line up under their stacks
    // rather than drifting as the label lengths differ.
    flex: 1,
  },
  monthActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.medium,
  },
  // Pushed to the card's floor by the auto margin rather than a fixed gap, so
  // the total sits on the baseline the row's tallest card sets.
  total: {
    marginTop: 'auto',
    paddingTop: Spacing.xl,
  },
  fill: {
    flex: 1,
  },
})
