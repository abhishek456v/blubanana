import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { Deal } from '@/types'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { PLATFORM_LABELS } from '@/constants/labels'
import { useTheme } from '@/hooks/useTheme'
import { getAdRightsStatus } from '@/lib/adRights'
import { formatCurrency, formatRelativeDay } from '@/lib/format'
import { PressableScale } from '@/components/ui'
import { BrandAvatar } from './BrandAvatar'
import { StatusPill } from './StatusPill'

// The next thing this deal needs, derived from where it is in the workflow.
function getNextDeadline(deal: Deal): { label: string; date: string | null } {
  switch (deal.status) {
    case 'intake':
    case 'script_due':
      return { label: 'Script', date: deal.script_due_date }
    case 'shooting':
      return { label: 'Shoot', date: deal.shoot_date }
    case 'editing':
      return { label: 'Edit', date: deal.edit_done_date }
    case 'published':
    case 'payment_awaited':
      return { label: 'Live', date: deal.publish_date }
    case 'paid':
      return { label: '', date: null }
  }
}

interface DealRowProps {
  deal: Deal
  onPress?: () => void
  /**
   * Overrides the derived deadline line — used by Home's "Needs you" section
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
          { backgroundColor: surface === 'raised' ? c.bgSurfaceRaised : c.bgSurface },
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

          {/* Ad rights only earn a line when they're running out — otherwise
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
