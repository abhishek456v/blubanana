import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'
import type { Deal, DealStage, DealStatus, Payment, PaymentStatus, Platform } from '@/types'
import {
  rescheduleWorkflowReminder,
  clearWorkflowReminder,
  respondToWorkflowReminder,
  type ReminderResponse,
} from './reminders'
import { reschedulePaymentReminders, cancelPaymentReminders, isPaymentOverdue } from './paymentReminders'
import { calculateAdRightsExpiry, rescheduleAdRightsReminder } from './adRights'

export interface AdRightsInput {
  ad_rights_granted: boolean
  ad_rights_fee: number | null
  ad_rights_duration_months: number | null
  ad_rights_start_date: string | null
}

export interface CreateDealInput {
  brand_id: string
  platform: Platform
  deliverable_description: string
  rate: number // whole INR rupees
  script_due_date?: string | null
  shoot_date?: string | null
  edit_done_date?: string | null
  publish_date?: string | null
  notes?: string | null
  payment_terms?: string | null
  ad_rights?: AdRightsInput | null
}

// RLS on deals restricts reads to the authenticated user's rows automatically.

// Dashboard needs enough of the payment row to compute the payment-due
// filter (lib/paymentReminders.ts getPaymentAlertTone); amount/paid_date are
// included too so the same fetch also powers the Revenue tab
// (lib/revenue.ts) without a second round trip.
/** Enough of a payment row for the dashboard, Money and the revenue figures. */
export type PaymentSummary = Pick<
  Payment,
  'id' | 'due_date' | 'status' | 'amount' | 'paid_date' | 'amount_received' | 'tds_amount' | 'label' | 'sort_order'
>

export type DealWithPaymentSummary = Deal & {
  /**
   * Every payment on the deal, in schedule order (migration 021).
   *
   * An array, not a single row: "50% advance, 50% on delivery" is the most
   * common arrangement in Indian creator work, and a deal could previously
   * hold only one payment. Most deals still have exactly one — go through the
   * helpers below rather than indexing into this.
   */
  payments: PaymentSummary[]
  /**
   * The deal's workflow, oldest stage first (migration 019).
   *
   * Embedded rather than fetched per deal: the dashboard shows a next-deadline
   * for every row, and a list of fifty deals would otherwise be fifty-one
   * round trips. PostgREST cannot order an embedded resource, so callers sort
   * by `sort_order` themselves — see `stagesInOrder`.
   */
  stages: DealStage[]
}

/**
 * A deal's stages in workflow order.
 *
 * Always go through this rather than reading `deal.stages` directly. PostgREST
 * returns embedded rows in no guaranteed order, so an unsorted read shows
 * Publish above Script often enough to look like a bug and rarely enough to
 * survive a quick test.
 */
export function stagesInOrder(deal: { stages?: DealStage[] | null }): DealStage[] {
  return [...(deal.stages ?? [])].sort((a, b) => a.sort_order - b.sort_order)
}

export async function getDeals(): Promise<DealWithPaymentSummary[]> {
  const { data, error } = await supabase
    .from('deals')
    .select(
      '*, brand:brands(*), payments(id, due_date, status, amount, paid_date, amount_received, tds_amount, label, sort_order), stages:deal_stages(*)'
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as DealWithPaymentSummary[]
}

// Powers the brand detail screen's deal history section.
export async function getDealsForBrand(brandId: string): Promise<DealWithPaymentSummary[]> {
  const { data, error } = await supabase
    .from('deals')
    .select(
      '*, brand:brands(*), payments(id, due_date, status, amount, paid_date, amount_received, tds_amount, label, sort_order), stages:deal_stages(*)'
    )
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as DealWithPaymentSummary[]
}

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const adRights = input.ad_rights
  const adRightsExpiresDate = adRights?.ad_rights_granted
    ? calculateAdRightsExpiry(adRights.ad_rights_start_date, adRights.ad_rights_duration_months)
    : null

  // Snapshot for rate benchmarking (lib/rateBenchmark.ts). Best-effort: a
  // missing snapshot just means this one deal won't count as a comparison
  // point later, not a save failure.
  const { data: profile } = await supabase
    .from('profiles')
    .select('follower_count')
    .eq('id', user.id)
    .single()

  const workspaceId = await getWorkspaceId()

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      workspace_id: workspaceId,
      brand_id: input.brand_id,
      creator_follower_count_at_time: profile?.follower_count ?? null,
      platform: input.platform,
      deliverable_description: input.deliverable_description,
      rate: input.rate,
      script_due_date: input.script_due_date ?? null,
      shoot_date: input.shoot_date ?? null,
      edit_done_date: input.edit_done_date ?? null,
      publish_date: input.publish_date ?? null,
      notes: input.notes ?? null,
      // Typed explicitly. Supabase's .insert() takes a loose object, so a stale
      // literal here type-checks cleanly and fails at the database's check
      // constraint instead — which is how 'intake' survived migration 020's
      // rename everywhere else in this file.
      status: 'active' satisfies DealStatus,
      ad_rights_granted: adRights?.ad_rights_granted ?? false,
      ad_rights_fee: adRights?.ad_rights_granted ? adRights.ad_rights_fee : null,
      ad_rights_duration_months: adRights?.ad_rights_granted ? adRights.ad_rights_duration_months : null,
      ad_rights_start_date: adRights?.ad_rights_granted ? adRights.ad_rights_start_date : null,
      ad_rights_expires_date: adRightsExpiresDate,
    })
    .select('*, brand:brands(*)')
    .single()

  if (dealError) throw dealError

  // Payment record is created at the same time as the deal so it's never orphaned.
  // Due date is calculated from publish date + terms if both are provided.
  const dueDate = calculateDueDate(input.publish_date, input.payment_terms)

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      // payments has no creator_id of its own; before workspaces it was scoped
      // through a subquery on deals. Carrying workspace_id directly is what
      // lets its RLS policy drop that per-row join.
      workspace_id: workspaceId,
      deal_id: deal.id,
      amount: input.rate,
      payment_terms: input.payment_terms ?? null,
      due_date: dueDate,
      status: 'pending',
    })
    .select()
    .single()

  if (paymentError) throw paymentError

  // Scheduling local reminders is best-effort: a failure here must never
  // fail the deal save, since both rows already exist at this point.
  try {
    const reminderFields = await rescheduleWorkflowReminder(deal as Deal)
    const paymentReminderFields = await reschedulePaymentReminders(payment as Payment, deal as Deal)
    const adRightsReminderFields = await rescheduleAdRightsReminder(deal as Deal)

    const { error: paymentReminderError } = await supabase
      .from('payments')
      .update(paymentReminderFields)
      .eq('id', payment.id)
    if (paymentReminderError) throw paymentReminderError

    const { data: finalDeal, error: dealReminderError } = await supabase
      .from('deals')
      .update({ ...reminderFields, ...adRightsReminderFields })
      .eq('id', deal.id)
      .select('*, brand:brands(*)')
      .single()
    if (dealReminderError) throw dealReminderError

    return finalDeal as Deal
  } catch {
    return deal as Deal
  }
}

// ─── Deal detail ────────────────────────────────────────────────────────────

// payments.deal_id is unique, so PostgREST infers a to-one relationship and
// embeds it as a single object, not an array, regardless of the '*'
// select shorthand. The `payment:` alias here makes that explicit.
export type DealWithPayments = Deal & { payments: Payment[]; stages: DealStage[] }

export async function getDeal(id: string): Promise<DealWithPayments> {
  const { data, error } = await supabase
    .from('deals')
    .select('*, brand:brands(*), payments(*), stages:deal_stages(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as DealWithPayments
}

const TIMELINE_FIELDS = ['script_due_date', 'shoot_date', 'edit_done_date', 'publish_date'] as const

export async function updateDeal(
  id: string,
  fields: Partial<
    Pick<
      Deal,
      | 'platform'
      | 'deliverable_description'
      | 'rate'
      | 'script_due_date'
      | 'shoot_date'
      | 'edit_done_date'
      | 'publish_date'
      | 'status'
      | 'live_link'
      | 'notes'
    >
  >
): Promise<Deal> {
  const { data: updated, error } = await supabase
    .from('deals')
    .update(fields)
    .eq('id', id)
    .select('*, brand:brands(*)')
    .single()
  if (error) throw error

  const touchesTimeline = TIMELINE_FIELDS.some((key) => key in fields)
  if (!touchesTimeline) return updated as Deal

  // Rescheduling is best-effort: a failure here must never fail the edit
  // the creator was actually trying to make.
  try {
    const reminderFields = await rescheduleWorkflowReminder(updated as Deal)
    const { data: final, error: reminderError } = await supabase
      .from('deals')
      .update(reminderFields)
      .eq('id', id)
      .select('*, brand:brands(*)')
      .single()
    if (reminderError) throw reminderError
    return final as Deal
  } catch {
    return updated as Deal
  }
}

// Manual content performance entry (Phase 2; see types/index.ts on why
// this is manual, not a live Instagram/YouTube sync).
export async function updatePerformance(
  dealId: string,
  fields: {
    performance_views: number | null
    performance_likes: number | null
    performance_comments: number | null
    performance_saves: number | null
  }
): Promise<void> {
  const { error } = await supabase
    .from('deals')
    .update({ ...fields, performance_updated_at: new Date().toISOString() })
    .eq('id', dealId)
  if (error) throw error
}

// Updates the payment record that belongs to a deal. Recalculates due_date
// from publish_date + payment_terms whenever either value changes, and
// reschedules the due-soon/due-today local reminders to match.
/**
 * Updates one payment row.
 *
 * Targets the payment by id, not the deal. It used to update by `deal_id`,
 * which was correct while a deal could only have one payment and would now
 * overwrite the amount and due date of every instalment on the deal with the
 * figures from whichever one the caller was editing (migration 021).
 *
 * Null payment is a no-op: a deal with no payment row has nothing to update,
 * and inventing one here would hide the fact that createDeal did not make it.
 */
export async function updatePaymentRecord(
  deal: Pick<Deal, 'id' | 'brand'>,
  payment: Pick<Payment, 'id' | 'due_soon_notification_id' | 'due_today_notification_id'> | null,
  {
    amount,
    paymentTerms,
    publishDate,
  }: { amount: number; paymentTerms: string | null; publishDate: string | null }
): Promise<void> {
  if (!payment) return

  const dueDate = calculateDueDate(publishDate, paymentTerms)
  const reminderFields = await reschedulePaymentReminders({ ...payment, due_date: dueDate }, deal)

  const { error } = await supabase
    .from('payments')
    .update({ amount, payment_terms: paymentTerms, due_date: dueDate, ...reminderFields })
    .eq('id', payment.id)
  if (error) throw error
}

// Updates a deal's ad rights block. Always writes the full set of fields:
// when granted is false, everything else is cleared out rather than left as
// stale data from a previous toggle-on. Recalculates expires_date and
// reschedules the 30-day reminder to match.
export async function updateAdRights(
  deal: Pick<Deal, 'id' | 'brand' | 'ad_rights_reminder_notification_id'>,
  input: AdRightsInput
): Promise<Pick<Deal, 'ad_rights_granted' | 'ad_rights_fee' | 'ad_rights_duration_months' | 'ad_rights_start_date' | 'ad_rights_expires_date' | 'ad_rights_reminder_notification_id'>> {
  const expiresDate = input.ad_rights_granted
    ? calculateAdRightsExpiry(input.ad_rights_start_date, input.ad_rights_duration_months)
    : null

  const fields = {
    ad_rights_granted: input.ad_rights_granted,
    ad_rights_fee: input.ad_rights_granted ? input.ad_rights_fee : null,
    ad_rights_duration_months: input.ad_rights_granted ? input.ad_rights_duration_months : null,
    ad_rights_start_date: input.ad_rights_granted ? input.ad_rights_start_date : null,
    ad_rights_expires_date: expiresDate,
  }

  const reminderFields = await rescheduleAdRightsReminder({
    id: deal.id,
    brand: deal.brand,
    ad_rights_granted: fields.ad_rights_granted,
    ad_rights_expires_date: fields.ad_rights_expires_date,
    ad_rights_reminder_notification_id: deal.ad_rights_reminder_notification_id,
  })

  const { error } = await supabase
    .from('deals')
    .update({ ...fields, ...reminderFields })
    .eq('id', deal.id)
  if (error) throw error

  return { ...fields, ...reminderFields }
}

// Called when the creator taps Done / +12 hours / tomorrow on the deal
// screen's reminder card.
export async function respondToReminder(
  deal: Deal,
  response: ReminderResponse
): Promise<
  Pick<Deal, 'reminder_stage' | 'reminder_fire_at' | 'reminder_notification_id' | 'reminder_completed_through'>
> {
  const fields = await respondToWorkflowReminder(deal, response)
  const { error } = await supabase.from('deals').update(fields).eq('id', deal.id)
  if (error) throw error
  return fields
}

// Lazily enforces the pending/reminder_sent → overdue transition on load,
// since there's no reliable background execution to do it the moment the
// due date actually passes (see lib/paymentReminders.ts isPaymentOverdue).
export async function syncPaymentStatus(
  dealId: string,
  payment: Pick<Payment, 'due_date' | 'status'>
): Promise<PaymentStatus> {
  if (!isPaymentOverdue(payment)) return payment.status

  const { error } = await supabase
    .from('payments')
    .update({ status: 'overdue' })
    .eq('deal_id', dealId)
  if (error) throw error

  return 'overdue'
}

// Called when the creator taps "Send WhatsApp reminder" on the due-soon
// card. Only moves status forward the first time (pending → reminder_sent);
// a resend while already reminder_sent/overdue is a no-op status-wise.
export async function markPaymentReminderSent(
  dealId: string,
  currentStatus: PaymentStatus
): Promise<PaymentStatus> {
  if (currentStatus !== 'pending') return currentStatus

  const { error } = await supabase
    .from('payments')
    .update({ status: 'reminder_sent' })
    .eq('deal_id', dealId)
  if (error) throw error

  return 'reminder_sent'
}

// ─── Status advancement ──────────────────────────────────────────────────────


// ── Payments ─────────────────────────────────────────────────────────────────
// A deal can carry several (migration 021). These helpers exist so no screen
// has to decide for itself what "the" payment is, which is how two screens end
// up disagreeing about whether a deal is paid.

type WithPayments = { payments?: { sort_order: number; due_date: string | null }[] | null }

/** Schedule order: advance first, then by due date. PostgREST does not sort embeds. */
export function paymentsInOrder<T extends { sort_order: number; due_date: string | null }>(
  deal: { payments?: T[] | null }
): T[] {
  return [...(deal.payments ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
  )
}

/**
 * The one payment a single-payment deal has.
 *
 * Most deals have exactly one, and a lot of the app is still written around
 * that. Returns the first in schedule order, or null for a deal with none.
 */
export function primaryPayment<T extends { sort_order: number; due_date: string | null }>(
  deal: { payments?: T[] | null }
): T | null {
  return paymentsInOrder(deal)[0] ?? null
}

/** The next one that still needs chasing, soonest first. Null when all settled. */
export function nextDuePayment<T extends PaymentSummary>(deal: { payments?: T[] | null }): T | null {
  return paymentsInOrder(deal).find((payment) => payment.status !== 'paid') ?? null
}

/**
 * What this deal is still owed.
 *
 * Sums the unpaid rows only. A part-paid deal owes the remainder, not the
 * whole, which is the difference between "still out" being a real number and
 * being roughly twice the truth on any deal with an advance.
 */
export function outstandingOn(deal: { payments?: PaymentSummary[] | null }): number {
  return paymentsInOrder(deal)
    .filter((payment) => payment.status !== 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0)
}

/** What actually landed: the received figure where recorded, else the amount. */
export function receivedOn(deal: { payments?: PaymentSummary[] | null }): number {
  return paymentsInOrder(deal)
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + (payment.amount_received ?? payment.amount), 0)
}

/** True only when every payment on the deal is settled. */
export function isFullyPaid(deal: { payments?: PaymentSummary[] | null }): boolean {
  const all = paymentsInOrder(deal)
  return all.length > 0 && all.every((payment) => payment.status === 'paid')
}

export const STATUS_ORDER: DealStatus[] = ['active', 'live', 'unpaid', 'paid']

export function getNextStatus(current: DealStatus): DealStatus | null {
  const idx = STATUS_ORDER.indexOf(current)
  return idx >= 0 && idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null
}

// Advances status and, when reaching 'paid', also closes out the payment
// record and cancels any still-scheduled local reminders for this deal.
export async function advanceDealStatus(deal: DealWithPayments): Promise<DealStatus | null> {
  const next = getNextStatus(deal.status)
  if (!next) return null

  await updateDeal(deal.id, { status: next })

  if (next === 'paid') {
    const today = new Date().toISOString().split('T')[0]

    // Settles every outstanding payment on the deal, not just one. A deal on
    // an advance has two, and marking the deal paid while a row still reads
    // unpaid is how "still out" ends up disagreeing with the deal list.
    //
    // amount_received is deliberately not written here. This path knows the
    // deal is settled but not what actually landed, and guessing the invoiced
    // figure would silently erase any TDS the brand withheld. The payment
    // dialog on deal detail is where the real number is captured.
    for (const payment of paymentsInOrder(deal)) {
      if (payment.status === 'paid') continue
      const reminderFields = await cancelPaymentReminders(payment)
      const { error } = await supabase
        .from('payments')
        .update({ status: 'paid', paid_date: today, ...reminderFields })
        .eq('id', payment.id)
      if (error) throw error
    }

    const workflowReminderFields = await clearWorkflowReminder(deal)
    const { error: dealReminderError } = await supabase
      .from('deals')
      .update(workflowReminderFields)
      .eq('id', deal.id)
    if (dealReminderError) throw dealReminderError
  }

  return next
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

// Parses "45 days from publish" → extracts the number → adds to publish date.
function calculateDueDate(
  publishDate: string | null | undefined,
  paymentTerms: string | null | undefined
): string | null {
  if (!publishDate || !paymentTerms) return null

  const match = paymentTerms.match(/(\d+)\s*days?/i)
  if (!match) return null

  const days = parseInt(match[1], 10)
  const [year, month, day] = publishDate.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return date.toISOString().split('T')[0]
}
