import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { stagesInOrder, type DealWithPaymentSummary } from '@/lib/deals'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { PLATFORM_LABELS } from '@/constants/labels'
import { useTheme } from '@/hooks/useTheme'
import { getAdRightsStatus } from '@/lib/adRights'
import { formatCurrency, formatRelativeDay } from '@/lib/format'
import { PressableScale } from '@/components/ui'
import { BrandAvatar } from './BrandAvatar'
import { StatusPill } from './StatusPill'

/**
 * The next thing this deal needs: its first stage that is not done.
 *
 * Read from the deal's own stages rather than switched on status, because
 * stages are user-defined now (migration 019) and a creator who renamed
 * "Shoot" to "Studio day" or added a client-review round would otherwise see a
 * label their deal does not contain.
 *
 * A paid deal needs nothing, whatever its stages say.
 */
function getNextDeadline(deal: DealWithPaymentSummary): { label: string; date: string | null } {
  if (deal.status === 'paid') return { label: '', date: null }

  const next = stagesInOrder(deal).find((stage) => !stage.done)
  return next ? { label: next.name, date: next.due_date } : { label: '', date: null }
}

interface DealRowProps {
  deal: DealWithPaymentSummary
  onPress?: () => void
  /**
   * Overrides the derived deadline line, used by Home's "Needs you" section
   * to say *why* the row is surfaced there rather than repeating the deadline.
   */
  reason?: string
  reasonColor?: string
  /** Position in the list, for the staggered entrance. */
  index?: number
  /**
   * `surface` sits on the page; `raised` sits *inside* a card, where the
   * default fill would be the same colour as its container and the row would
   * disappear.
   */
  surface?: 'surface' | 'raised'
  /**
   * `card` is a filled, rounded row. `plain` drops the fill and separates by a
   * hairline instead.
   *
   * A long list of filled rows reads as a stack of chips: every item carries a
   * container, so the containers become the pattern and the content inside
   * them stops being the thing you see. A plain list lets alignment do that
   * work, which is what the design references mean by letting the grid carry
   * the order.
   */
  variant?: 'card' | 'plain'
  /** Trims the row on desktop, where a phone-height row wastes the window. */
  dense?: boolean
  /**
   * Fill the height of a flex parent. For the desktop two-column archive
   * grid, where two rows in the same line otherwise sit at different heights
   * because one carries a deadline line and the other doesn't.
   */
  stretch?: boolean
}

export function DealRow({
  deal,
  onPress,
  reason,
  reasonColor,
  index = 0,
  surface = 'surface',
  stretch = false,
  variant = 'card',
  dense = false,
}: DealRowProps) {
  const { c } = useTheme()
  const { label: deadlineLabel, date: deadlineDate } = getNextDeadline(deal)
  const brandName = deal.brand?.name ?? 'Unknown brand'
  const platformLabel = PLATFORM_LABELS[deal.platform] ?? deal.platform
  const adRightsStatus = getAdRightsStatus(deal)

  const adRightsColor =
    adRightsStatus === 'expired'
      ? c.textMuted
      : adRightsStatus === 'expiring_soon'
        ? c.warning
        : c.accent

  return (
    <Animated.View
      entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(index))}
      style={stretch && styles.fill}
    >
      <PressableScale
        style={[
          styles.row,
          stretch && styles.fill,
          dense && styles.rowDense,
          variant === 'plain'
            ? [styles.rowPlain, { borderBottomColor: c.border }]
            : {
                backgroundColor: surface === 'raised' ? c.bgSurfaceRaised : c.bgSurface,
              },
        ]}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`${brandName}, ${formatCurrency(deal.rate)}`}
      >
        <BrandAvatar name={brandName} size={38} />

        <View style={styles.center}>
          <Text style={[styles.brandName, { color: c.textPrimary }]} numberOfLines={1}>
            {brandName}
          </Text>
          <Text style={[styles.deliverable, { color: c.textSecondary }]} numberOfLines={1}>
            {platformLabel} · {deal.deliverable_description}
          </Text>

          {reason ? (
            <Text style={[styles.meta, { color: reasonColor ?? c.warning }]} numberOfLines={1}>
              {reason}
            </Text>
          ) : deadlineDate ? (
            <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
              {deadlineLabel} {formatRelativeDay(deadlineDate).toLowerCase()}
            </Text>
          ) : null}

          {/* Ad rights only earn a line when they're running out; otherwise
              every row with rights carries a permanent line of noise. */}
          {!reason && adRightsStatus && adRightsStatus !== 'active' && deal.ad_rights_expires_date ? (
            <Text style={[styles.meta, { color: adRightsColor }]} numberOfLines={1}>
              Ad rights{' '}
              {adRightsStatus === 'expired'
                ? `ended ${formatRelativeDay(deal.ad_rights_expires_date).toLowerCase()}`
                : `end ${formatRelativeDay(deal.ad_rights_expires_date).toLowerCase()}`}
            </Text>
          ) : null}
        </View>

        <View style={styles.trailing}>
          <Text style={[styles.rate, { color: c.textPrimary }]} numberOfLines={1}>
            {formatCurrency(deal.rate)}
          </Text>
          <StatusPill status={deal.status} />
        </View>
      </PressableScale>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  rowPlain: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderBottomWidth: 1,
    // The hairline runs the full width, so the row's own horizontal padding
    // would inset it from the content above. Alignment is the whole point of
    // dropping the fill, so it goes flush.
    paddingHorizontal: 0,
  },
  rowDense: {
    paddingVertical: Spacing.base,
  },
  center: {
    flex: 1,
    gap: Spacing.xxs,
  },
  brandName: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  deliverable: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  meta: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: 1,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 5,
  },
  rate: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.display,
  },
})
