import { StyleSheet, Text, View } from 'react-native'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { formatCurrencyCompact } from '@/lib/format'
import {
  Figure,
  GradientCard,
  OrbitRing,
  PeriodPill,
  PressableScale,
  type OrbitItem,
} from '@/components/ui'

export interface BrandStanding {
  id: string
  name: string
  total: number
}

export interface TopBrandsCardProps {
  /** Highest-earning first. */
  brands: readonly BrandStanding[]
  periods: readonly string[]
  period: string
  onPeriodChange: (period: string) => void
  onPress: () => void
}

/**
 * Who actually pays her, ranked.
 *
 * The one card on Home about relationships rather than amounts, which is why
 * it takes the neutral `ink` gradient: put a third saturated card on the row
 * and the eye stops picking a starting point.
 *
 * The centre chip is the top earner and the ring is the rest of the roster.
 * The callout names the leader in words, because two initials in a circle is a
 * recogniser, not a label, and the card would otherwise rank brands without
 * ever saying who won.
 */
export function TopBrandsCard({
  brands,
  periods,
  period,
  onPeriodChange,
  onPress,
}: TopBrandsCardProps) {
  const [leader, ...rest] = brands
  const ring: OrbitItem[] = rest
    .slice(0, 5)
    .map((brand) => ({ id: brand.id, label: brand.name }))

  return (
    // Not pressable as a whole, unlike the other two cards: the period pill in
    // its header is a real control, and a control inside a pressable card is a
    // nested `<button>` on web. The callout at the foot carries the navigation
    // instead, which is also the only part of the card that names a
    // destination.
    <GradientCard
      gradient="ink"
      title="Top brands"
      action={
        <PeriodPill options={periods} value={period} onChange={onPeriodChange} tone="ink" />
      }
      style={styles.fill}
    >
      <View style={styles.countRow}>
        <Figure value={String(brands.length)} size="lg" color="#FFFFFF" />
        <Text style={styles.countWord}>{brands.length === 1 ? 'brand' : 'brands'}</Text>
      </View>

      <View style={styles.ringSlot}>
        <OrbitRing
          center={leader ? { id: leader.id, label: leader.name } : null}
          items={ring}
          size={180}
        />
      </View>

      {leader ? (
        <PressableScale
          onPress={onPress}
          style={styles.callout}
          accessibilityRole="button"
          accessibilityLabel={`${leader.name} paid the most ${period.toLowerCase()}: ${formatCurrencyCompact(leader.total)}. Open Brands.`}
        >
          <View style={styles.calloutText}>
            <Text style={styles.calloutName} numberOfLines={1}>
              {leader.name}
            </Text>
            {/* `period` already reads "This year", so the caption cannot
                supply its own "this" without saying it twice. */}
            <Text style={styles.calloutCaption}>paid the most {period.toLowerCase()}</Text>
          </View>
          <Figure value={formatCurrencyCompact(leader.total)} size="md" color="#FFFFFF" bold />
        </PressableScale>
      ) : (
        <Text style={styles.empty}>No brands on the books yet.</Text>
      )}
    </GradientCard>
  )
}

const styles = StyleSheet.create({
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
  // Absorbs the extra height when a taller card sets the row's height. The
  // flex is on the slot, not the ring: the ring is a fixed-size SVG and
  // stretching it ovals the circles.
  ringSlot: {
    marginVertical: Spacing.lg,
    flex: 1,
    justifyContent: 'center',
  },
  fill: {
    flex: 1,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.md,
  },
  calloutText: {
    flex: 1,
  },
  calloutName: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
  calloutCaption: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.55)',
  },
  empty: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.55)',
  },
})
