import { StyleSheet, Text, View } from 'react-native'
import { FontFamily, Spacing, Typography } from '@/constants/design'
import { formatCurrency, parseLocalDate } from '@/lib/format'
import {
  CircleButton,
  Figure,
  FigureBlock,
  GradientCard,
  OrbitRing,
  type OrbitItem,
} from '@/components/ui'

export interface UpcomingPayment {
  id: string
  brand: string
  amount: number
  dueDate: string
}

export interface UpcomingPaymentsCardProps {
  /** Soonest first. Only the first two are drawn; the rest feed the ring. */
  payments: readonly UpcomingPayment[]
  onPress: () => void
}

/**
 * What is owed, and when it lands.
 *
 * The card states two payments rather than a total, because a total is a
 * number you can do nothing about and a due date is a number you can act on.
 * The four corners are the two soonest payments: amount and brand on the
 * outside edges, day and month on the inside, so the two figures sit at the
 * card's extremes and the labels face each other.
 *
 * The ring is every brand that currently owes her, with the soonest at the
 * centre. It carries no magnitude and is not trying to: the amounts are
 * already stated in the corners, and a second encoding of the same numbers
 * would be the third time the card said them.
 */
export function UpcomingPaymentsCard({ payments, onPress }: UpcomingPaymentsCardProps) {
  const [next, following] = payments
  const ring: OrbitItem[] = payments
    .slice(1, 6)
    .map((payment) => ({ id: payment.id, label: payment.brand }))

  return (
    <GradientCard
      gradient="blue"
      title="Upcoming payments"
      onPress={onPress}
      accessibilityLabel={
        next
          ? `Upcoming payments. Next: ${formatCurrency(next.amount)} from ${next.brand}.`
          : 'Upcoming payments. Nothing outstanding.'
      }
      // The whole card is the tap target, so the disc is a plain one: nesting
      // a pressable inside a pressable is invalid HTML on web.
      action={<CircleButton icon="arrow-forward" iconRotate={-45} accessibilityLabel="Open Money" />}
      style={styles.fill}
    >
      {next ? (
        <View style={styles.row}>
          <FigureBlock
            label={next.brand}
            figure={<Figure value={formatCurrency(next.amount)} size="lg" color="#FFFFFF" />}
          />
          <FigureBlock
            align="right"
            label={monthOf(next.dueDate)}
            figure={<Figure value={dayOf(next.dueDate)} size="lg" color="#FFFFFF" />}
          />
        </View>
      ) : (
        <Text style={styles.clear}>Every deal is settled. Nothing is outstanding.</Text>
      )}

      <View style={styles.ringSlot}>
        <OrbitRing
          center={next ? { id: next.id, label: next.brand } : null}
          items={ring}
          size={180}
        />
      </View>

      {following ? (
        <View style={styles.row}>
          <FigureBlock
            reverse
            label={following.brand}
            figure={<Figure value={formatCurrency(following.amount)} size="lg" color="#FFFFFF" />}
          />
          <FigureBlock
            reverse
            align="right"
            label={monthOf(following.dueDate)}
            figure={<Figure value={dayOf(following.dueDate)} size="lg" color="#FFFFFF" />}
          />
        </View>
      ) : (
        // Holds the card's height steady whether there are two payments or
        // one, so a row of cards does not jog when a payment is marked paid.
        <View style={styles.rowPlaceholder} />
      )}
    </GradientCard>
  )
}

/** Zero-padded, because `02` and `28` want the same width in a dot face. */
function dayOf(dateStr: string): string {
  return String(parseLocalDate(dateStr).getDate()).padStart(2, '0')
}

function monthOf(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-IN', { month: 'short' })
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rowPlaceholder: {
    // One figure plus its label at `lg`.
    height: 56,
  },
  // Absorbs whatever extra height the tallest card in the row sets, so the
  // bottom pair stays pinned to the card's floor instead of floating directly
  // under the ring with dead space beneath it. The flex lives on the slot, not
  // on the ring: the ring is a fixed-size SVG and stretching it ovals the
  // circles.
  ringSlot: {
    marginVertical: Spacing.lg,
    flex: 1,
    justifyContent: 'center',
  },
  fill: {
    flex: 1,
  },
  clear: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.72)',
  },
})
