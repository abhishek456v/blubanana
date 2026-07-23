import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native'
import type { Deal } from '@/types'
import { Colors, Spacing, Radius, Typography, FontFamily } from '@/constants/design'
import { PLATFORM_LABELS } from '@/constants/labels'
import { getAdRightsStatus } from '@/lib/adRights'
import { BrandAvatar } from './BrandAvatar'
import { StatusPill } from './StatusPill'

// Returns the label and date for the *next* action needed on this deal.
function getNextDeadline(deal: Deal): { label: string; date: string | null } {
  switch (deal.status) {
    case 'intake':
    case 'script_due':
      return { label: 'Script due', date: deal.script_due_date }
    case 'shooting':
      return { label: 'Shoot day', date: deal.shoot_date }
    case 'editing':
      return { label: 'Edit done', date: deal.edit_done_date }
    case 'published':
    case 'payment_awaited':
      return { label: 'Published', date: deal.publish_date }
    case 'paid':
      return { label: '', date: null }
  }
}

// Parses YYYY-MM-DD as a local date to avoid UTC offset shifting the displayed day.
function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

interface DealRowProps {
  deal: Deal
  onPress?: () => void
}

export function DealRow({ deal, onPress }: DealRowProps) {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const { label: deadlineLabel, date: deadlineDate } = getNextDeadline(deal)
  const brandName = deal.brand?.name ?? 'Unknown brand'
  const platformLabel = PLATFORM_LABELS[deal.platform] ?? deal.platform
  const adRightsStatus = getAdRightsStatus(deal)
  const adRightsColor =
    adRightsStatus === 'expired' ? c.textMuted : adRightsStatus === 'expiring_soon' ? c.warning : c.accent

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: c.bgSurface }]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={!onPress}
    >
      <BrandAvatar name={brandName} size={36} />

      <View style={styles.center}>
        <Text style={[styles.brandName, { color: c.textPrimary }]} numberOfLines={1}>
          {brandName}
        </Text>
        <Text style={[styles.deliverable, { color: c.textSecondary }]} numberOfLines={1}>
          {platformLabel} · {deal.deliverable_description}
        </Text>
        {deadlineDate ? (
          <Text style={[styles.deadline, { color: c.textMuted }]}>
            {deadlineLabel} {formatDate(deadlineDate)}
          </Text>
        ) : null}
        {adRightsStatus && deal.ad_rights_expires_date ? (
          <Text style={[styles.adRights, { color: adRightsColor }]} numberOfLines={1}>
            Ad rights{' '}
            {adRightsStatus === 'expired'
              ? `expired ${formatDate(deal.ad_rights_expires_date)}`
              : `until ${formatDate(deal.ad_rights_expires_date)}`}
          </Text>
        ) : null}
      </View>

      <StatusPill status={deal.status} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  center: {
    flex: 1,
    gap: 2,
  },
  brandName: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  deliverable: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  deadline: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },
  adRights: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
})
