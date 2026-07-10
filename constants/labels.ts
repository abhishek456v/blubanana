import type { Platform, DealStatus, PaymentStatus, ReminderStage } from '@/types'

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram_reel: 'Instagram Reel',
  instagram_feed: 'Instagram Feed',
  youtube_short: 'YouTube Short',
  youtube_long: 'YouTube Long-form',
  podcast: 'Podcast',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
  other: 'Other',
}

export const STATUS_LABELS: Record<DealStatus, string> = {
  intake: 'Intake',
  script_due: 'Script due',
  shooting: 'Shooting',
  editing: 'Editing',
  published: 'Published',
  payment_awaited: 'Payment awaited',
  paid: 'Paid',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  reminder_sent: 'Reminder sent',
  overdue: 'Overdue',
  paid: 'Paid',
}

export const REMINDER_STAGE_LABELS: Record<ReminderStage, string> = {
  script_due: 'Script due',
  shoot: 'Shoot day',
  editing: 'Edit due',
  publish: 'Publish day',
  live_link_submission: 'Add live link',
}

export const PLATFORMS: { key: Platform; label: string }[] = [
  { key: 'instagram_reel', label: 'Instagram Reel' },
  { key: 'instagram_feed', label: 'Instagram Feed' },
  { key: 'youtube_short', label: 'YouTube Short' },
  { key: 'youtube_long', label: 'YouTube Long-form' },
  { key: 'podcast', label: 'Podcast' },
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'other', label: 'Other' },
]
