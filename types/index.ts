// Shared data-model types.
//
// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT: money is a whole number of rupees.
//
// Every money value in this codebase (`rate`, `amount`, `unit_amount`,
// `total_amount`, `gst_amount`, `tds_amount`, `ad_rights_fee`) is an integer
// count of RUPEES. Not paise, and never a float.
//
// Why not float: `0.1 + 0.2 !== 0.3`. Floating point is how money silently
// goes wrong, so it is not used anywhere in this path.
//
// Why not paise, given the architecture spec asks for the smallest currency
// unit: that rule exists to rule out floats, which integers already do. Paise
// would add precision this product cannot use:
//
//   - deal rates, fees and payments in this market are whole rupees
//   - GST is the only place a fraction arises, and under s.170 of the CGST Act
//     tax on an invoice is rounded to the nearest rupee by law
//
// so the sub-rupee digits would be computed and then legally discarded, in
// exchange for touching every money column and every display site.
//
// WHEN TO REVISIT: the first non-INR currency. USD has real cents, and at that
// point this becomes a currency migration (per-row currency code, conversion,
// display formatting) rather than a change of scale, so it should be designed
// then, not pre-empted now.
//
// If you are adding a money column: make it `integer`, name it so the audit
// trigger in migration 012 picks it up, and add it to `watched` there.
// ─────────────────────────────────────────────────────────────────────────────

// `podcast` was removed in migration 007; podcasts are published on YouTube
// or Instagram, so it was never a destination of its own. Existing podcast
// deals were remapped to `youtube_long`.
export type Platform =
  | 'instagram_reel'
  | 'instagram_feed'
  | 'instagram_story'
  | 'youtube_short'
  | 'youtube_long'
  | 'twitter'
  | 'linkedin'
  | 'other'

/**
 * What was actually sold on a deal.
 *
 * `ad_rights` (the brand may run this as a paid ad) and `auto_dm` (the
 * "comment LINK and I'll DM you" setup) are commercial add-ons rather than
 * pieces of content, so they carry no platform.
 */
export type DeliverableKind =
  | 'reel'
  | 'story'
  | 'carousel'
  | 'static_post'
  | 'yt_short'
  | 'yt_long'
  | 'yt_integration'
  | 'live'
  | 'ad_rights'
  | 'auto_dm'
  | 'other'

/**
 * Where a deal sits in its commercial lifecycle (migration 020).
 *
 * Deliberately says nothing about the work. Status used to carry the workflow
 * too — intake, script_due, shooting, editing — which stopped being coherent
 * once stages became user-defined in 019: a renamed stage left the pill
 * lying, an added stage had no status to occupy, and nothing kept the two in
 * sync. The stages describe the work; this describes the money.
 *
 * "Which stage is this deal on" is answered by the first stage that is not
 * done, under whatever name the creator gave it.
 */
export type DealStatus =
  | 'active'
  | 'live'
  | 'unpaid'
  | 'paid'

export type PaymentStatus = 'pending' | 'reminder_sent' | 'overdue' | 'paid'

/**
 * One stage of one deal's workflow (migration 019).
 *
 * Replaces the four fixed date columns on `deals`. Creators do not all work the
 * same way: some script and shoot on the same day, some run a client-review
 * round, some do three edit passes. A new deal starts with the four defaults
 * because they fit most people, and every one of them can be renamed, removed
 * or added to.
 *
 * `done` and `done_at` are separate deliberately. Historical stages migrated
 * from the old columns know from the deal's status *which* stages were
 * finished, but nothing records *when* — so `done` is set and `done_at` stays
 * null rather than being stamped with a fabricated time.
 */
export interface DealStage {
  id: string
  workspace_id: string
  deal_id: string
  name: string
  sort_order: number
  /** `YYYY-MM-DD`, or null when this stage has no date yet. */
  due_date: string | null
  done: boolean
  done_at: string | null
  created_at: string
  updated_at: string
}

/** The four a new deal starts with. Order matters; it is the default sequence. */
export const DEFAULT_STAGE_NAMES = ['Script', 'Shoot', 'Edit', 'Publish'] as const

/**
 * A person at a brand (migration 019).
 *
 * Agency contacts change constantly, and a payment chased at someone who left
 * six months ago is a payment that does not arrive. Exactly one contact per
 * brand can be primary — enforced by a partial unique index, not by the UI —
 * and that is the one the WhatsApp nudges address.
 */
export interface BrandContact {
  id: string
  workspace_id: string
  brand_id: string
  name: string
  phone: string | null
  email: string | null
  /** Free text: "Marketing manager", "Agency lead". */
  role: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

// Workflow reminder sequence (PRODUCT.md 2.3). Only one stage is ever active
// per deal at a time: 'live_link_submission' has no dedicated date column,
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
  // Billing/invoice details (Phase 3 tax & invoicing), all optional, filled
  // in from Settings before the creator generates their first invoice.
  upi_id: string | null
  bank_account_number: string | null
  ifsc_code: string | null
  gstin: string | null
  /** Rule 46(a): mandatory on a tax invoice (migration 018). */
  address: string | null
  // Shown on the shareable public profile card (Phase 3).
  niche: string | null
  public_profile_enabled: boolean
  public_share_slug: string | null
  created_at: string
}

export interface Brand {
  id: string
  workspace_id: string
  name: string
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  notes: string | null
  /**
   * Tax details (migration 018). Held here so the creator types them once;
   * each invoice snapshots its own copy. `state_code` is separate from the
   * GSTIN because an unregistered brand still has a place of supply.
   */
  gstin: string | null
  address: string | null
  state_code: string | null
  created_at: string
}

export interface Deal {
  id: string
  workspace_id: string
  brand_id: string
  platform: Platform
  deliverable_description: string
  /**
   * INR, whole rupees — and null when the reader is not allowed to see it.
   *
   * Migration 025 masks this column for a manager without `can_see_rates`, in
   * the database rather than on screen, so the value genuinely does not arrive.
   * Null here means "withheld", never "free": a deal always has a rate. Treat
   * it as unknown and render a placeholder; do not coalesce it to 0, which
   * would fold a hidden figure into a visible total as if it were nothing.
   */
  rate: number | null
  /**
   * A retainer contract: "four Reels a month for six months" (§8.15).
   *
   * True only on the first month's deal, which carries the contract terms.
   * Months two onward are ordinary deals with `retainer_parent_id` set — so
   * every list, total, reminder and invoice already works on them, which is
   * the whole reason they are real deals rather than a generated schedule
   * hanging off one row.
   */
  is_retainer: boolean
  /** Contract length, counting the first month. Set only when `is_retainer`. */
  retainer_months: number | null
  /** Deliverables per month. Recorded for the brief; not enforced. */
  retainer_per_period: number | null
  /** The first month's deal, on months two onward. Null on the parent itself. */
  retainer_parent_id: string | null
  script_due_date: string | null
  shoot_date: string | null
  edit_done_date: string | null
  publish_date: string | null
  status: DealStatus
  live_link: string | null
  notes: string | null
  // Workflow reminder scheduling state: a client-side cache of what's
  // currently scheduled as a local OS notification (PRODUCT.md 2.3).
  reminder_stage: ReminderStage | null
  reminder_fire_at: string | null
  reminder_notification_id: string | null
  // Furthest stage explicitly marked Done, distinct from reminder_stage so
  // a date added retroactively to an earlier, never-completed stage can
  // still resurface it (see lib/reminders.ts rescheduleWorkflowReminder).
  reminder_completed_through: ReminderStage | null
  // Ad rights, an optional add-on term. The brand pays extra for the right
  // to reuse the creator's content in paid ads for a fixed window.
  // expires_date is stored, not derived, so it can be queried directly and
  // so the 30-day-before reminder has a stable date to schedule against.
  ad_rights_granted: boolean
  ad_rights_fee: number | null // INR, whole rupees
  ad_rights_duration_months: number | null
  ad_rights_start_date: string | null
  ad_rights_expires_date: string | null
  ad_rights_reminder_notification_id: string | null
  // Rate benchmarking (Phase 2, simplified: no social API integration).
  // A snapshot of the creator's follower count when this deal was created,
  // so later deals can be compared against it without needing historical
  // Instagram/YouTube data.
  creator_follower_count_at_time: number | null
  // Manual content performance entry (Phase 2). Automated sync from
  // Instagram/YouTube needs OAuth app credentials that don't exist yet;
  // this is the creator-entered stand-in.
  performance_views: number | null
  performance_likes: number | null
  performance_comments: number | null
  performance_saves: number | null
  performance_updated_at: string | null
  /**
   * Paused, not cancelled (migration 019).
   *
   * A held deal keeps whatever stage it reached and stays fully visible; it
   * just stops counting as expected income until it is un-held. That is the
   * whole point: without it, "Still out" slowly fills with deals that are
   * never going to pay, and the one number this app exists to get right
   * becomes fiction.
   */
  on_hold: boolean
  on_hold_at: string | null
  /**
   * Foreign-currency deals (migration 019).
   *
   * `rate` is ALWAYS the INR figure, in every deal, so every existing query,
   * report and total is unaffected. A non-INR deal additionally records what
   * was actually agreed (`rate_original`) and the rate it was converted at
   * (`fx_rate`), snapshotted at entry — last year's dollar deal must not
   * silently revalue at today's rate.
   */
  currency: string
  rate_original: number | null
  fx_rate: number | null
  created_at: string
  updated_at: string
  brand?: Brand // joined on fetch
}

/**
 * One line item on a deal: a reel, three stories, an auto-DM setup, the ad
 * rights. Added in migration 007; replaces the single
 * `Deal.deliverable_description` text field, which could not express a
 * collaboration made of several dated, separately-priced pieces.
 *
 * Performance numbers live here rather than on the deal because a reel and a
 * story from the same collaboration perform nothing alike.
 */
export interface Deliverable {
  id: string
  workspace_id: string
  deal_id: string
  kind: DeliverableKind
  platform: Platform | null
  quantity: number
  description: string | null
  /** INR, whole rupees. Null when withheld — see the note on `Deal.rate`. */
  rate: number | null
  due_date: string | null
  published_at: string | null
  live_link: string | null
  // Ad-rights terms. Only meaningful when kind is 'ad_rights'.
  duration_months: number | null
  starts_on: string | null
  expires_on: string | null
  // Manual performance entry; no Instagram/YouTube API integration yet.
  views: number | null
  likes: number | null
  comments: number | null
  saves: number | null
  shares: number | null
  reach: number | null
  performance_updated_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  deal_id: string
  amount: number // INR, whole rupees
  payment_terms: string | null // e.g. "45 days from publish"
  due_date: string | null
  status: PaymentStatus
  paid_date: string | null
  // Payment reminder scheduling state: same client-side cache pattern as
  // Deal's reminder_* fields (PRODUCT.md 2.4).
  due_soon_notification_id: string | null
  due_today_notification_id: string | null
  /**
   * What actually landed, which is routinely not what was invoiced
   * (migration 019).
   *
   * A brand invoiced ₹1,00,000 that withholds ₹10,000 TDS pays ₹90,000. Both
   * numbers are needed: the gross for the tax return, the net to reconcile
   * against the bank. Null means "not recorded yet", which is not the same as
   * zero.
   */
  amount_received: number | null
  tds_amount: number
  /**
   * Which instalment this is: "Advance", "On delivery". Null for a deal paid
   * in one go, which is most of them.
   */
  label: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// One post-deal review, prompted once a deal reaches 'paid' (Phase 2 client
// reputation score). One per deal; deal_id is unique.
export interface BrandRating {
  id: string
  workspace_id: string
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
// generation time, so editing/deleting the brand later never changes a
// previously issued invoice.
/**
 * One billed line on an invoice (migration 008).
 *
 * Exists so a single invoice can cover several deals: three reels for the
 * same brand across a month, billed together, which is what a brand's finance
 * team expects against one PO.
 */
export interface InvoiceLineItem {
  id: string
  workspace_id: string
  invoice_id: string
  /** Null for an ad-hoc line with no deal behind it (a reshoot, an expense). */
  deal_id: string | null
  description: string
  /** GST requires an HSN/SAC on the invoice. 998397 = other advertising services. */
  hsn_sac: string
  quantity: number
  unit_amount: number // INR, whole rupees
  amount: number // quantity * unit_amount
  sort_order: number
  created_at: string
}

export interface Invoice {
  id: string
  workspace_id: string
  /** Null on a consolidated invoice: the deals live on the line items. */
  deal_id: string | null
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
  /**
   * The tax split by head (migration 018). Under the IGST Act a supply is
   * inter-State when the supplier's State differs from the place of supply,
   * carrying IGST at the full rate; intra-State supplies carry CGST and SGST
   * at half each. A recipient cannot claim input credit against the wrong
   * head, so these are stored rather than derived at render time.
   *
   * All three are 0 on invoices issued before 018, where the place of supply
   * was never recorded and the head is genuinely unknown.
   */
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  /** State code of the place of supply, e.g. '27'. See constants/gst.ts. */
  place_of_supply_code: string | null
  /** Snapshotted at generation time, like brand_name. */
  brand_gstin: string | null
  brand_address: string | null
  supplier_address: string | null
  /** Rule 46(o). Always false for a creator's own services, but stated. */
  reverse_charge: boolean
  total_amount: number
  payment_due_date: string | null
  tds_deducted: boolean
  tds_amount: number | null
  notes: string | null
  created_at: string
}

// Best-effort fields pulled from a screenshot or voice transcript by the
// extract-deal edge function. Every field is optional/nullable, since the AI may
// miss some, and the creator always reviews/edits before saving (PRODUCT.md 2.1).
export interface ExtractedDeliverable {
  kind: DeliverableKind
  quantity: number
  description: string | null
  rate: number | null
}

export interface ExtractedDealFields {
  brand_name: string | null
  platform: Platform | null
  deliverable_description: string | null
  /** Itemised breakdown. Empty when the source described only one thing. */
  deliverables: ExtractedDeliverable[]
  rate: number | null // whole INR rupees
  payment_terms: string | null
  script_due_date: string | null // YYYY-MM-DD
  shoot_date: string | null
  edit_done_date: string | null
  publish_date: string | null
  notes: string | null
}
