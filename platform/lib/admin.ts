import { supabase } from './supabase'
import { base64ToBytes } from './bytes'

/**
 * The admin dashboard's data layer.
 *
 * Everything goes through one edge function. Not because one function is
 * tidier, but because the alternative is a browser holding a key that can read
 * every creator's business, which would undo all of the tenancy work in a
 * single line of configuration.
 *
 * The function re-checks the caller's role on the server every time. Nothing
 * here is trusted, and nothing here needs to be.
 */
async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin', {
    body: { action, ...extra },
  })

  // A non-2xx from an edge function arrives as a FunctionsHttpError whose
  // useful part is in the response body, not the message. Without this, every
  // refusal reads "Edge Function returned a non-2xx status code", which is how
  // "still used by 1 announcement" turns into a mystery.
  if (error) {
    const response = (error as { context?: Response }).context
    if (response && typeof response.json === 'function') {
      const body = await response.json().catch(() => null)
      if (body?.error) throw new Error(body.error)
    }
    throw error
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  return data as T
}

// ── The morning screen ───────────────────────────────────────────────────────

export interface AdminOverview {
  workspaces: number
  deals: number
  invoices: number
  subscriptions: Record<string, number>
}

export interface HealthSocialAccount {
  id: string
  platform: string
  handle: string
  status: string
  last_error: string | null
  last_synced_at: string | null
  workspace_id: string
}

export interface HealthReminder {
  id: string
  type: string
  title: string
  status: string
  scheduled_for: string
  workspace_id: string
}

export interface HealthMessage {
  id: string
  channel: string
  purpose: string
  recipient: string | null
  status: string
  created_at: string
  workspace_id: string
}

/**
 * Database values, said the way a person would say them.
 *
 * These tables store enums, which is right for storage and wrong for a screen.
 * The health page showed "whatsapp · payment_reminder_overdue" truncated to
 * "payment_reminder_..." until this existed, which told the reader nothing at
 * all about what had failed.
 */
export const CHANNEL_NAMES: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
}

export const PURPOSE_NAMES: Record<string, string> = {
  delivery_notification: 'Telling a brand the work is live',
  payment_reminder_pre: 'Payment reminder, before it is due',
  payment_reminder_due: 'Payment reminder, on the day',
  payment_reminder_overdue: 'Chasing an overdue payment',
  ad_rights_followup: 'Following up on ad rights',
  invoice_delivery: 'Sending an invoice',
  custom: 'A message written by hand',
}

export const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
}

export const REMINDER_TYPE_NAMES: Record<string, string> = {
  workflow: 'A deadline',
  payment: 'A payment',
  ad_rights: 'Ad rights',
  survey: 'A survey',
  tax: 'A tax date',
}

/** A lookup that falls back to the raw value rather than to an empty string. */
export const nameFor = (map: Record<string, string>, key: string) => map[key] ?? key

export interface AdminHealth {
  socialAccounts: HealthSocialAccount[]
  missedReminders: HealthReminder[]
  stuckMessages: HealthMessage[]
  workspaceNames: Record<string, string>
}

export interface AdminFunnel {
  total: number
  withBrand: number
  withDeal: number
  withInvoice: number
  rows: {
    id: string
    name: string
    created_at: string
    brand: boolean
    deal: boolean
    invoice: boolean
  }[]
}

export const getAdminOverview = () => call<AdminOverview>('overview')
export const getAdminHealth = () => call<AdminHealth>('health')
export const getAdminFunnel = () => call<AdminFunnel>('funnel')

/** Everything the health screen counts as needing attention, in one number. */
export function healthIssueCount(health: AdminHealth): number {
  return health.socialAccounts.length + health.missedReminders.length + health.stuckMessages.length
}

// ── People ───────────────────────────────────────────────────────────────────

export interface AdminPerson {
  workspace_id: string
  workspace_name: string
  type: string
  created_at: string
  user_id: string | null
  name: string | null
  email: string | null
  phone: string | null
  niche: string | null
  followers: number | null
  deals: number
  status: string | null
  billing_term: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  cancelled_at: string | null
  is_internal: boolean
}

export const getAdminPeople = () => call<{ rows: AdminPerson[] }>('people').then((r) => r.rows)

export interface WorkspaceSnapshot {
  workspace: { id: string; name: string; type: string; timezone: string; created_at: string }
  owner: { user_id: string; name: string | null; email: string | null; phone: string | null } | null
  brands: number
  invoices: number
  deals: {
    id: string
    deliverable_description: string | null
    platform: string
    status: string
    rate: number | null
    created_at: string
  }[]
  reminders: { id: string; type: string; status: string; scheduled_for: string }[]
  social: { platform: string; handle: string; status: string }[]
  receivedRupees: number
  pendingRupees: number
}

/**
 * A read-only look at one creator's workspace.
 *
 * Not a way to sign in as them. The question that actually gets asked is
 * always "what is really there", and answering it should not come with the
 * ability to change it.
 */
export const getWorkspaceSnapshot = (workspaceId: string) =>
  call<WorkspaceSnapshot>('people.snapshot', { workspace_id: workspaceId })

// ── Activity ─────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string
  workspace_id: string
  actor_user_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  changes: Record<string, unknown> | null
  created_at: string
}

export const getAdminActivity = (workspaceId?: string) =>
  call<{
    rows: ActivityEntry[]
    workspaceNames: Record<string, string>
    actorNames: Record<string, string>
  }>('activity', workspaceId ? { workspace_id: workspaceId } : {})

// ── Subscriptions ────────────────────────────────────────────────────────────

export interface AdminSubscription {
  workspace_id: string
  workspace_name: string
  status: string
  billing_term: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  intro_applied: boolean
  agreed_term_paise: number | null
  is_internal: boolean
  cancelled_at: string | null
  created_at: string
  razorpay_subscription_id: string | null
  paid_total_paise: number
  last_paid_at: string | null
}

export const getAdminSubscriptions = () =>
  call<{ rows: AdminSubscription[]; collectedPaise: number }>('subscriptions')

export type SubscriptionLever = 'extend_trial' | 'comp_month' | 'uncancel' | 'set_status'

export const adjustSubscription = (input: {
  workspace_id: string
  lever: SubscriptionLever
  days?: number
  status?: string
}) => call<{ row: AdminSubscription }>('subscriptions.adjust', input)

// ── Broadcast ────────────────────────────────────────────────────────────────

export interface Announcement {
  id: string
  kind: 'news' | 'banner' | 'alert'
  /** bar: a line in the top strip. popup: a card over the page. image: a picture. */
  placement: 'bar' | 'popup' | 'image'
  image_url: string | null
  sort_order: number
  title: string
  body: string | null
  surface: 'app' | 'website' | 'both'
  audience: 'everyone' | 'trialing' | 'paying' | 'lapsed'
  link_url: string | null
  link_label: string | null
  dismissible: boolean
  starts_at: string
  ends_at: string | null
  published: boolean
  created_at: string
}

/** Everything, drafts included. The public policy only exposes live ones. */
export const listAnnouncements = () =>
  call<{ rows: Announcement[] }>('announcements.list').then((r) => r.rows)

export const saveAnnouncement = (announcement: Partial<Announcement>) =>
  call<{ row: Announcement }>('announcements.save', { announcement }).then((r) => r.row)

export const deleteAnnouncement = (id: string) => call<{ ok: true }>('announcements.delete', { id })

/** Whether an announcement is on screen right now, for the admin list. */
export function isLive(a: Announcement, now = new Date()): boolean {
  if (!a.published) return false
  if (new Date(a.starts_at) > now) return false
  return !a.ends_at || new Date(a.ends_at) > now
}

// ── Media ────────────────────────────────────────────────────────────────────

export type MediaFolder = 'general' | 'website' | 'blog' | 'app' | 'broadcast'

export interface MediaItem {
  id: string
  kind: 'image' | 'video' | 'document'
  path: string
  url: string
  title: string
  alt: string | null
  mime: string
  bytes: number
  width: number | null
  height: number | null
  folder: string
  created_at: string
}

export const listMedia = (folder?: string) =>
  call<{ rows: MediaItem[]; folders: string[] }>('media.list', folder ? { folder } : {})

export const updateMedia = (id: string, patch: { title?: string; alt?: string }) =>
  call<{ row: MediaItem }>('media.update', { id, ...patch })

export class MediaInUse extends Error {}

export const deleteMedia = (id: string, force = false) =>
  call<{ ok: true }>('media.delete', { id, force }).catch((error: Error) => {
    if (/still used by/i.test(error.message)) throw new MediaInUse(error.message)
    throw error
  })

export const sweepMedia = (confirm = false) =>
  call<{ orphans: string[]; removed: boolean }>('media.sweep', { confirm })

/**
 * Upload one file into the public library.
 *
 * Three steps, and the middle one is the point: the browser never holds a
 * standing right to write into the bucket. It asks the server for permission
 * to put one file at one path, uses it, and it expires. The path is decided by
 * the server, so a filename cannot decide where a file lands.
 */
export async function uploadMedia(input: {
  /** base64, because it is the one form a picked file takes identically on web and native. */
  base64: string
  mime: string
  title: string
  alt?: string
  folder?: MediaFolder
  width?: number
  height?: number
}): Promise<MediaItem> {
  const { path, token } = await call<{ path: string; token: string; bucket: string }>(
    'media.uploadUrl',
    { mime: input.mime, folder: input.folder ?? 'general' }
  )

  const { error } = await supabase.storage
    .from('public-media')
    .uploadToSignedUrl(path, token, base64ToBytes(input.base64), { contentType: input.mime })
  if (error) throw error

  const { row } = await call<{ row: MediaItem }>('media.register', {
    path,
    mime: input.mime,
    title: input.title,
    alt: input.alt ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
  })
  return row
}

/** `2.4 MB`, `812 KB`. Files are talked about in whole units, not bytes. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

// ── Support ──────────────────────────────────────────────────────────────────

export type TicketStatus = 'new' | 'open' | 'waiting' | 'closed'

export interface SupportTicket {
  id: string
  workspace_id: string | null
  user_id: string | null
  email: string | null
  subject: string
  body: string
  status: TicketStatus
  priority: 'low' | 'normal' | 'high'
  assigned_to: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

export interface TicketNote {
  id: string
  ticket_id: string
  author_id: string | null
  is_internal: boolean
  body: string
  created_at: string
}

export const listTickets = (status: 'open' | 'all' | TicketStatus = 'open') =>
  call<{
    rows: SupportTicket[]
    workspaceNames: Record<string, string>
    openCount: number
  }>('support.list', { status })

export const getTicket = (id: string) =>
  call<{ ticket: SupportTicket; notes: TicketNote[]; authorEmails: Record<string, string> }>(
    'support.get',
    { id }
  )

export const replyToTicket = (ticketId: string, body: string, isInternal = false) =>
  call<{ note: TicketNote }>('support.reply', {
    ticket_id: ticketId,
    body,
    is_internal: isInternal,
  })

export const updateTicket = (
  id: string,
  patch: { status?: TicketStatus; priority?: string; assigned_to?: string | null }
) => call<{ row: SupportTicket }>('support.update', { id, ...patch })

// ── Feature switches ─────────────────────────────────────────────────────────

export interface FeatureFlag {
  key: string
  label: string
  description: string
  enabled: boolean
  updated_at: string
}

export const listFlags = () => call<{ rows: FeatureFlag[] }>('flags.list').then((r) => r.rows)

export const setFlag = (key: string, enabled: boolean) =>
  call<{ row: FeatureFlag }>('flags.set', { key, enabled }).then((r) => r.row)

// ── Data requests ────────────────────────────────────────────────────────────

export interface DataRequest {
  id: string
  user_id: string | null
  workspace_id: string | null
  email: string | null
  kind: 'access' | 'erasure'
  status: 'new' | 'in_progress' | 'done' | 'refused'
  note: string | null
  created_at: string
  due_at: string
  completed_at: string | null
}

export const listDataRequests = () =>
  call<{ rows: DataRequest[]; workspaceNames: Record<string, string> }>('data.list')

export const updateDataRequest = (id: string, patch: { status: string; note?: string }) =>
  call<{ row: DataRequest }>('data.update', { id, ...patch })

// ── The blog ─────────────────────────────────────────────────────────────────

export interface BlogPost {
  id: string
  slug: string
  title: string
  date: string
  updated: string | null
  read_minutes: number
  description: string
  lede: string
  body_html: string
  tool_href: string
  tool_label: string
  cover_url: string | null
  published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Everything, drafts included.
 *
 * `deployConfigured` says whether publishing can actually ask the website to
 * rebuild. It comes from the server because the answer is a function secret,
 * and the screen has to be able to say "saved, but the site will not update
 * until a deploy hook exists" rather than implying the post is live.
 */
export const listPosts = () =>
  call<{ rows: BlogPost[]; deployConfigured: boolean; destinations: string[] }>('blog.list')

/**
 * The website paths a post may send somebody to, said in words.
 *
 * The list itself comes from the server, so the editor can only offer what the
 * server will accept. This is only the wording, and an unknown path falls back
 * to the path itself rather than disappearing.
 */
export const DESTINATION_NAMES: Record<string, string> = {
  '/tools': 'All the calculators',
  '/tools/advance-tax-calculator': 'Advance tax calculator',
  '/tools/tds-calculator': 'TDS calculator',
  '/tools/gst-calculator': 'GST calculator',
  '/tools/rate-calculator': 'Rate calculator',
  '/tools/engagement-rate-calculator': 'Engagement rate calculator',
  '/pricing': 'Pricing',
  '/features': 'What it does',
  '/features/deals': 'Deals',
  '/features/deadlines': 'Deadlines',
  '/features/payments': 'Payments',
  '/features/invoices': 'Invoices',
  '/features/tax': 'Tax',
  '/features/rate-card': 'Rate card',
  '/features/team': 'Team',
  '/features/offline': 'Offline',
  '/compare': 'How it compares',
  '/contact': 'Contact',
  '/security': 'Security',
  '/blog': 'The blog',
}

export const savePost = (post: Partial<BlogPost>) =>
  call<{ row: BlogPost; deployed: boolean }>('blog.save', { post })

export const deletePost = (id: string) =>
  call<{ ok: true; deployed: boolean }>('blog.delete', { id })

export interface ImportedDoc {
  title: string
  body_html: string
  read_minutes: number
  images: number
  warnings: string[]
}

/** A .docx, turned into a draft. base64, for the same reason media uploads are. */
export const importDocx = (base64: string) => call<ImportedDoc>('blog.import', { file: base64 })

/** Rebuild the website now, with nothing changed. */
export const deploySite = () => call<{ deployed: boolean }>('site.deploy')

// ── Editable copy ────────────────────────────────────────────────────────────

export interface ContentLine {
  key: string
  value: string
  kind: 'text' | 'html'
  label: string
  hint: string | null
  /** website: needs a rebuild. app: takes effect next time somebody opens it. */
  area: 'website' | 'app'
  sort_order: number
  updated_at: string
}

export const listContent = () =>
  call<{ rows: ContentLine[]; deployConfigured: boolean }>('content.list')

export const saveContent = (key: string, value: string) =>
  call<{ row: ContentLine; deployed: boolean }>('content.save', { key, value })

// ── The price list ───────────────────────────────────────────────────────────

export interface Pricing {
  list_monthly_paise: number
  yearly_discount_percent: number
  intro_discount_percent: number
  intro_customer_limit: number
  seats: number
  updated_at: string
}

export interface BillingTerm {
  key: string
  label: string
  months: number
  term_multiplier: string
  sort_order: number
}

export const getPricing = () =>
  call<{ pricing: Pricing; terms: BillingTerm[]; introSeatsTaken: number }>('pricing.get')

export const savePricing = (patch: Partial<Pricing>) =>
  call<{ row: Pricing; deployed: boolean }>('pricing.save', patch)

// ── What the dashboard itself did ────────────────────────────────────────────

export interface AdminAuditEntry {
  id: string
  actor_id: string
  role: string
  action: string
  detail: Record<string, unknown> | null
  created_at: string
}

export const getAdminAudit = () =>
  call<{ rows: AdminAuditEntry[]; actorEmails: Record<string, string> }>('admin.audit')
