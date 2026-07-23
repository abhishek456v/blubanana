// Shared data-model types for the full Phase 1 schema.
// All four core objects are typed here even if only used partially in Step 1.

export type Platform =
  | 'instagram_reel'
  | 'instagram_feed'
  | 'youtube_short'
  | 'youtube_long'
  | 'podcast'
  | 'twitter'
  | 'linkedin'
  | 'other'

export type DealStatus =
  | 'intake'
  | 'script_due'
  | 'shooting'
  | 'editing'
  | 'published'
  | 'payment_awaited'
  | 'paid'

export type PaymentStatus = 'pending' | 'reminder_sent' | 'overdue' | 'paid'

// Workflow reminder sequence (PRODUCT.md 2.3). Only one stage is ever active
// per deal at a time — 'live_link_submission' has no dedicated date column,
// it's scheduled for the day after publish_date.
export type ReminderStage =
  | 'script_due'
  | 'shoot'
  | 'editing'
  | 'publish'
  | 'live_link_submission'

export interface Creator {
  id: string
  name: string
  phone: string | null
  follower_count: number | null
  // Billing/invoice details (Phase 3 tax & invoicing) — all optional, filled
  // in from Settings before the creator generates their first invoice.
  upi_id: string | null
  bank_account_number: string | null
  ifsc_code: string | null
  gstin: string | null
  // Shown on the shareable public profile card (Phase 3).
  niche: string | null
  public_profile_enabled: boolean
  public_share_slug: string | null
  created_at: string
}

export interface Brand {
  id: string
  creator_id: string
  name: string
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  notes: string | null
  created_at: string
}

export interface Deal {
  id: string
  creator_id: string
  brand_id: string
  platform: Platform
  deliverable_description: string
  rate: number // INR, whole rupees
  script_due_date: string | null
  shoot_date: string | null
  edit_done_date: string | null
  publish_date: string | null
  status: DealStatus
  live_link: string | null
  notes: string | null
  // Workflow reminder scheduling state — a client-side cache of what's
  // currently scheduled as a local OS notification (PRODUCT.md 2.3).
  reminder_stage: ReminderStage | null
  reminder_fire_at: string | null
  reminder_notification_id: string | null
  // Furthest stage explicitly marked Done — distinct from reminder_stage so
  // a date added retroactively to an earlier, never-completed stage can
  // still resurface it (see lib/reminders.ts rescheduleWorkflowReminder).
  reminder_completed_through: ReminderStage | null
  // Ad rights — an optional add-on term: the brand pays extra for the right
  // to reuse the creator's content in paid ads for a fixed window.
  // expires_date is stored, not derived, so it can be queried directly and
  // so the 30-day-before reminder has a stable date to schedule against.
  ad_rights_granted: boolean
  ad_rights_fee: number | null // INR, whole rupees
  ad_rights_duration_months: number | null
  ad_rights_start_date: string | null
  ad_rights_expires_date: string | null
  ad_rights_reminder_notification_id: string | null
  // Rate benchmarking (Phase 2, simplified — no social API integration).
  // A snapshot of the creator's follower count when this deal was created,
  // so later deals can be compared against it without needing historical
  // Instagram/YouTube data.
  creator_follower_count_at_time: number | null
  // Manual content performance entry (Phase 2). Automated sync from
  // Instagram/YouTube needs OAuth app credentials that don't exist yet —
  // this is the creator-entered stand-in.
  performance_views: number | null
  performance_likes: number | null
  performance_comments: number | null
  performance_saves: number | null
  performance_updated_at: string | null
  created_at: string
  updated_at: string
  brand?: Brand // joined on fetch
}

export interface Payment {
  id: string
  deal_id: string
  amount: number // INR, whole rupees
  payment_terms: string | null // e.g. "45 days from publish"
  due_date: string | null
  status: PaymentStatus
  paid_date: string | null
  // Payment reminder scheduling state — same client-side cache pattern as
  // Deal's reminder_* fields (PRODUCT.md 2.4).
  due_soon_notification_id: string | null
  due_today_notification_id: string | null
  created_at: string
  updated_at: string
}

// One post-deal review, prompted once a deal reaches 'paid' (Phase 2 client
// reputation score). One per deal — deal_id is unique.
export interface BrandRating {
  id: string
  creator_id: string
  brand_id: string
  deal_id: string
  rating: number // 1-5
  paid_on_time: boolean | null
  easy_to_work_with: boolean | null
  revision_rounds: number | null
  would_work_again: boolean | null
  notes: string | null
  created_at: string
}

// Phase 3 tax & invoicing. Brand contact fields are snapshotted at
// generation time — editing/deleting the brand later never changes a
// previously issued invoice.
export interface Invoice {
  id: string
  creator_id: string
  deal_id: string
  invoice_number: string
  invoice_date: string
  brand_name: string
  brand_contact_person: string | null
  brand_contact_email: string | null
  description: string
  amount: number // INR, pre-GST
  gst_applicable: boolean
  gst_rate: number
  gst_amount: number
  total_amount: number
  payment_due_date: string | null
  tds_deducted: boolean
  tds_amount: number | null
  notes: string | null
  created_at: string
}

// Best-effort fields pulled from a screenshot or voice transcript by the
// extract-deal edge function. Every field is optional/nullable — the AI may
// miss some, and the creator always reviews/edits before saving (PRODUCT.md 2.1).
export interface ExtractedDealFields {
  brand_name: string | null
  platform: Platform | null
  deliverable_description: string | null
  rate: number | null // whole INR rupees
  payment_terms: string | null
  script_due_date: string | null // YYYY-MM-DD
  shoot_date: string | null
  edit_done_date: string | null
  publish_date: string | null
  notes: string | null
}
