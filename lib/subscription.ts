import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'

// The trial, the plans and the read-only state (PRODUCT.md §3, migration 035).
//
// Everything here is a *reading* of state the database already enforces. The
// gate itself is a restrictive RLS policy: if this module were deleted, an
// expired workspace would still be unable to write. What it adds is the ability
// to say so before she tries, rather than after a save fails.

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'expired'
  | 'cancelled'

export type BillingTerm =
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'nine_month'
  | 'yearly'

export interface Pricing {
  listMonthlyPaise: number
  yearlyDiscountPercent: number
  introDiscountPercent: number
  introCustomerLimit: number
  seats: number
}

export interface Term {
  key: BillingTerm
  label: string
  months: number
  /** Multiplied by the monthly rate for the whole term. Below `months` only where discounted. */
  termMultiplier: number
}

export interface Subscription {
  status: SubscriptionStatus
  trialEndsAt: string
  currentPeriodEnd: string | null
  billingTerm: BillingTerm | null
  introApplied: boolean
}

/** §3: at most this many deals during the trial. Everything else is unlimited. */
export const TRIAL_DEAL_LIMIT = 10

export async function getPricing(): Promise<Pricing> {
  const { data, error } = await supabase
    .from('pricing')
    .select('list_monthly_paise, yearly_discount_percent, intro_discount_percent, intro_customer_limit, seats')
    .single()

  if (error) throw error
  return {
    listMonthlyPaise: data.list_monthly_paise as number,
    yearlyDiscountPercent: data.yearly_discount_percent as number,
    introDiscountPercent: data.intro_discount_percent as number,
    introCustomerLimit: data.intro_customer_limit as number,
    seats: data.seats as number,
  }
}

export async function getTerms(): Promise<Term[]> {
  const { data, error } = await supabase
    .from('billing_terms')
    .select('key, label, months, term_multiplier')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    key: row.key as BillingTerm,
    label: row.label as string,
    months: row.months as number,
    termMultiplier: Number(row.term_multiplier),
  }))
}

/** How many of the launch places are left. Zero means the intro has ended. */
export async function introPlacesLeft(pricing: Pricing): Promise<number> {
  const { data, error } = await supabase.rpc('intro_seats_taken')
  if (error) throw error
  return Math.max(0, pricing.introCustomerLimit - ((data as number) ?? 0))
}

/**
 * The monthly rate, in paise.
 *
 * Mirrors `monthly_rate_paise()` in 035, including the rounding. The discount
 * applies to the MONTHLY rate and the term multiplier applies afterwards —
 * halving the term price instead gives ₹1,000 for a month (50% of ₹1,999 is
 * ₹999.50) and ₹2,998 for three months when three months is defined as three
 * times the monthly rate. Rounded down, because a price that rounds up past the
 * advertised figure is a price the advertisement got wrong.
 */
export function monthlyRatePaise(pricing: Pricing, applyIntro: boolean): number {
  if (!applyIntro) return pricing.listMonthlyPaise
  return Math.floor((pricing.listMonthlyPaise * (1 - pricing.introDiscountPercent / 100)) / 100) * 100
}

/** What a whole term costs, in paise, ex-GST. */
export function termPricePaise(pricing: Pricing, term: Term, applyIntro: boolean): number {
  return Math.floor((monthlyRatePaise(pricing, applyIntro) * term.termMultiplier) / 100) * 100
}

/** Rupees from paise, for display. See the unit note in 035. */
export function rupeesOf(paise: number): number {
  return Math.round(paise / 100)
}

/** GST is added at billing, not baked into the price. §3. */
export const GST_PERCENT = 18

export function withGst(rupees: number): number {
  return Math.round(rupees * (1 + GST_PERCENT / 100))
}

/** The per-month figure to print under a multi-month term. */
export function effectiveMonthlyRupees(
  pricing: Pricing,
  term: Term,
  applyIntro: boolean
): number {
  return Math.round(rupeesOf(termPricePaise(pricing, term, applyIntro)) / term.months)
}

/** Percentage saved against paying monthly for the same span. Zero on monthly. */
export function termSavingPercent(term: Term): number {
  return Math.round(((term.months - term.termMultiplier) / term.months) * 100)
}

export async function getSubscription(): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end, billing_term, intro_applied')
    .eq('workspace_id', await getWorkspaceId())
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    status: data.status as SubscriptionStatus,
    trialEndsAt: data.trial_ends_at as string,
    currentPeriodEnd: (data.current_period_end as string | null) ?? null,
    billingTerm: (data.billing_term as BillingTerm | null) ?? null,
    introApplied: (data.intro_applied as boolean | null) ?? false,
  }
}

export interface Entitlement {
  /** False once the trial has run out and no subscription covers the workspace. */
  canWrite: boolean
  isTrialing: boolean
  /** Whole days left, rounded up: "1 day left" should show for the last 24 hours. */
  trialDaysLeft: number
  status: SubscriptionStatus
}

/**
 * What the app is allowed to do, mirroring `auth_writable_workspace_ids()`.
 *
 * Deliberately fails OPEN when there is no subscription row — the same as the
 * database function. A workspace created before 035, or by a path that skipped
 * the trigger, must not find itself read-only because of our bookkeeping.
 */
export function entitlementOf(subscription: Subscription | null): Entitlement {
  if (!subscription) {
    return { canWrite: true, isTrialing: false, trialDaysLeft: 0, status: 'active' }
  }

  const now = Date.now()
  const trialEnds = new Date(subscription.trialEndsAt).getTime()
  const periodEnds = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : null

  const isTrialing = subscription.status === 'trialing' && trialEnds > now
  const isPaid =
    (subscription.status === 'active' || subscription.status === 'past_due') &&
    (periodEnds === null || periodEnds > now)

  return {
    canWrite: isTrialing || isPaid,
    isTrialing,
    trialDaysLeft: isTrialing ? Math.max(1, Math.ceil((trialEnds - now) / 86_400_000)) : 0,
    status: subscription.status,
  }
}

/** How many more deals the trial allows. Null when the limit does not apply. */
export async function trialDealsRemaining(
  subscription: Subscription | null
): Promise<number | null> {
  if (!entitlementOf(subscription).isTrialing) return null

  const { count, error } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  return Math.max(0, TRIAL_DEAL_LIMIT - (count ?? 0))
}

/**
 * True when a failure came from the trial's deal limit rather than anything else.
 *
 * The trigger tags it with a hint (035) so this does not have to match on the
 * message text, which would break the first time the wording changed.
 */
export function isTrialLimitError(error: unknown): boolean {
  const record = error as { hint?: string; message?: string } | null
  return (
    record?.hint === 'trial_deal_limit' ||
    /limited to \d+ deals/i.test(record?.message ?? '')
  )
}
