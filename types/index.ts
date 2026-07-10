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
