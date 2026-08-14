import type {
  DealStatus,
  DeliverableKind,
  PaymentStatus,
  Platform,
  ReminderStage,
} from '@/types'

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram_reel: 'Reel',
  instagram_feed: 'Post',
  instagram_story: 'Story',
  youtube_short: 'Short',
  youtube_long: 'YouTube',
  twitter: 'X',
  linkedin: 'LinkedIn',
  other: 'Other',
}

export const STATUS_LABELS: Record<DealStatus, string> = {
  intake: 'New',
  script_due: 'Script',
  shooting: 'Shoot',
  editing: 'Edit',
  published: 'Live',
  payment_awaited: 'Unpaid',
  paid: 'Paid',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  reminder_sent: 'Nudged',
  overdue: 'Overdue',
  paid: 'Paid',
}

export const REMINDER_STAGE_LABELS: Record<ReminderStage, string> = {
  script_due: 'Script',
  shoot: 'Shoot',
  editing: 'Edit',
  publish: 'Publish',
  live_link_submission: 'Add link',
}

export const PLATFORMS: { key: Platform; label: string }[] = [
  { key: 'instagram_reel', label: 'Reel' },
  { key: 'instagram_feed', label: 'Post' },
  { key: 'instagram_story', label: 'Story' },
  { key: 'youtube_short', label: 'Short' },
  { key: 'youtube_long', label: 'YouTube' },
  { key: 'twitter', label: 'X' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'other', label: 'Other' },
]

export const DELIVERABLE_LABELS: Record<DeliverableKind, string> = {
  reel: 'Reel',
  story: 'Story',
  carousel: 'Carousel',
  static_post: 'Post',
  yt_short: 'Short',
  yt_long: 'YouTube video',
  yt_integration: 'Integration',
  live: 'Live',
  ad_rights: 'Ad rights',
  auto_dm: 'Auto DM',
  other: 'Other',
}

/**
 * Ordered for the picker: the things creators sell most often first, the two
 * commercial add-ons last (they behave differently — no platform, and ad
 * rights carries a duration).
 */
export const DELIVERABLE_KINDS: { key: DeliverableKind; label: string }[] = [
  { key: 'reel', label: 'Reel' },
  { key: 'story', label: 'Story' },
  { key: 'carousel', label: 'Carousel' },
  { key: 'static_post', label: 'Post' },
  { key: 'yt_short', label: 'Short' },
  { key: 'yt_long', label: 'YouTube video' },
  { key: 'yt_integration', label: 'Integration' },
  { key: 'live', label: 'Live' },
  { key: 'auto_dm', label: 'Auto DM' },
  { key: 'ad_rights', label: 'Ad rights' },
  { key: 'other', label: 'Other' },
]

/** Add-ons priced as terms rather than as content. */
export const COMMERCIAL_KINDS: DeliverableKind[] = ['ad_rights', 'auto_dm']

/** The platform a deliverable defaults to, so the picker pre-fills sensibly. */
export const DEFAULT_PLATFORM_FOR_KIND: Record<DeliverableKind, Platform | null> = {
  reel: 'instagram_reel',
  story: 'instagram_story',
  carousel: 'instagram_feed',
  static_post: 'instagram_feed',
  yt_short: 'youtube_short',
  yt_long: 'youtube_long',
  yt_integration: 'youtube_long',
  live: 'instagram_reel',
  ad_rights: null,
  auto_dm: null,
  other: 'other',
}
