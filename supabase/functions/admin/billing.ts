// Subscriptions: who is paying, who is about to stop, and the four levers for
// putting something right.
//
// The levers matter more than the list. A creator whose card failed on the day
// of a shoot does not want a refund policy, she wants the thing to keep
// working while she sorts it out, and the difference between a good week and a
// bad one is whether that takes a click or a database console.

import { Ctx, Refused, json, one, oneOf, rows, str } from './lib.ts'
import { triggerDeploy } from './writing.ts'

const STATUSES = ['trialing', 'active', 'past_due', 'cancelled', 'expired'] as const

export async function subscriptions(ctx: Ctx) {
  const { db } = ctx

  // Note the columns. An earlier version of this asked for `id` and `term`,
  // neither of which exists on this table: the primary key is workspace_id and
  // the column is billing_term. PostgREST refused it, the error was swallowed,
  // and the endpoint reported that nobody had a subscription. Everything here
  // is now checked against the schema, and `rows()` throws rather than
  // returning an empty list when a query is wrong.
  const [subs, workspaces, payments] = await Promise.all([
    db
      .from('subscriptions')
      .select(
        'workspace_id, status, billing_term, trial_ends_at, current_period_end, ' +
          'intro_applied, agreed_term_paise, is_internal, cancelled_at, created_at, ' +
          'razorpay_subscription_id'
      )
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('workspaces').select('id, name'),
    db
      .from('subscription_payments')
      .select('workspace_id, total_paise, status, paid_at')
      .eq('status', 'paid'),
  ])

  const names = new Map(rows<{ id: string; name: string }>(workspaces).map((w) => [w.id, w.name]))

  const paidByWorkspace = new Map<string, { total: number; last: string | null }>()
  for (const p of rows<{ workspace_id: string; total_paise: number; paid_at: string }>(payments)) {
    const current = paidByWorkspace.get(p.workspace_id) ?? { total: 0, last: null }
    current.total += p.total_paise ?? 0
    if (!current.last || (p.paid_at && p.paid_at > current.last)) current.last = p.paid_at
    paidByWorkspace.set(p.workspace_id, current)
  }

  const list = rows<{ workspace_id: string }>(subs).map((s) => {
    const paid = paidByWorkspace.get(s.workspace_id)
    return {
      ...s,
      workspace_name: names.get(s.workspace_id) ?? 'Unnamed',
      paid_total_paise: paid?.total ?? 0,
      last_paid_at: paid?.last ?? null,
    }
  })

  // Money in, all of it, from the payments table rather than by adding up what
  // people are supposed to be paying. Those two numbers differ the moment
  // anybody is comped, and only one of them is real.
  const collectedPaise = [...paidByWorkspace.values()].reduce((sum, p) => sum + p.total, 0)

  await ctx.audit({ subscriptions: list.length })
  return json({ rows: list, collectedPaise })
}

/**
 * The escape hatches.
 *
 * All four go through one action with a named lever rather than four actions,
 * so that every one of them is audited the same way and none can be added
 * later without a record. `detail` carries the before and after, because "the
 * trial was extended" is not much use without "from what, to what".
 */
export async function adjust(ctx: Ctx) {
  const { db, body } = ctx
  const workspaceId = str(body, 'workspace_id')
  const lever = oneOf(
    body.lever,
    ['extend_trial', 'comp_month', 'uncancel', 'set_status'] as const,
    'extend_trial'
  )

  const before = one<Record<string, unknown>>(
    await db
      .from('subscriptions')
      .select('workspace_id, status, trial_ends_at, current_period_end, cancelled_at')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
  )

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const days = Math.min(Math.max(Number(body.days ?? 14) || 14, 1), 365)

  if (lever === 'extend_trial') {
    // From whichever is later: today, or the end of the trial they are on. An
    // extension granted to somebody whose trial ended last week should give
    // them the days, not backdate them into another expiry.
    const from = laterOf(before.trial_ends_at as string | null)
    patch.trial_ends_at = addDays(from, days).toISOString()
    patch.status = 'trialing'
    patch.cancelled_at = null
  } else if (lever === 'comp_month') {
    const from = laterOf(before.current_period_end as string | null)
    patch.current_period_end = addDays(from, days).toISOString()
    patch.status = 'active'
    patch.cancelled_at = null
  } else if (lever === 'uncancel') {
    if (!before.cancelled_at) throw new Refused('That one is not cancelled')
    patch.cancelled_at = null
    patch.status = 'active'
  } else {
    patch.status = oneOf(body.status, STATUSES, 'active')
    if (patch.status === 'cancelled') patch.cancelled_at = new Date().toISOString()
    else patch.cancelled_at = null
  }

  const after = one<Record<string, unknown>>(
    await db.from('subscriptions').update(patch).eq('workspace_id', workspaceId).select().single()
  )

  await ctx.audit({ workspace_id: workspaceId, lever, days, before, patch })
  return json({ row: after })
}

/** Now, or the given moment, whichever is later. */
function laterOf(iso: string | null): Date {
  const now = new Date()
  if (!iso) return now
  const given = new Date(iso)
  return given > now ? given : now
}

function addDays(from: Date, days: number): Date {
  const out = new Date(from)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}


// ── The price list ───────────────────────────────────────────────────────────

/**
 * What everybody pays, and how many intro places are left.
 *
 * These two tables already drive the public pricing page: the website reads
 * them at runtime with the anonymous key, so a change here is visible on
 * blubanana.in within seconds and without a deploy. That is exactly why they
 * are worth having behind a screen, and exactly why nothing but this function
 * may write them.
 */
export async function pricingGet(ctx: Ctx) {
  const [pricing, terms, taken] = await Promise.all([
    ctx.db.from('pricing').select('*').eq('id', true).maybeSingle(),
    ctx.db.from('billing_terms').select('*').order('sort_order'),
    // The counter that drives "N places left" on the public page. Read through
    // the same function the website uses, so the dashboard cannot disagree
    // with what a visitor is being told.
    ctx.db.rpc('intro_seats_taken'),
  ])

  await ctx.audit()
  return json({
    pricing: one(pricing),
    terms: rows(terms),
    introSeatsTaken: Number((taken as { data?: number }).data ?? 0),
  })
}

/**
 * Change the price, or the number of intro places.
 *
 * Every field is bounded. Not because an admin is not trusted, but because
 * this is the one screen in the product where a slipped decimal point is
 * charged to real people: 199900 paise is ₹1,999, and the same number typed
 * with one more zero is ₹19,990. A ceiling turns that into a refusal rather
 * than into an apology.
 */
export async function pricingSave(ctx: Ctx) {
  const body = ctx.body

  const before = one<Record<string, unknown>>(
    await ctx.db.from('pricing').select('*').eq('id', true).maybeSingle()
  )

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.list_monthly_paise !== undefined) {
    const paise = Math.round(Number(body.list_monthly_paise))
    // ₹99 to ₹9,999 a month. Wide enough for any real decision, narrow enough
    // that a typo cannot get through.
    if (!Number.isFinite(paise) || paise < 9900 || paise > 999900) {
      throw new Refused('The monthly price has to be between ₹99 and ₹9,999')
    }
    patch.list_monthly_paise = paise
  }

  if (body.yearly_discount_percent !== undefined) {
    patch.yearly_discount_percent = bounded(body.yearly_discount_percent, 0, 60, 'The yearly discount')
  }
  if (body.intro_discount_percent !== undefined) {
    patch.intro_discount_percent = bounded(body.intro_discount_percent, 0, 90, 'The intro discount')
  }
  if (body.intro_customer_limit !== undefined) {
    patch.intro_customer_limit = bounded(body.intro_customer_limit, 0, 100000, 'The number of intro places')
  }
  if (body.seats !== undefined) {
    patch.seats = bounded(body.seats, 1, 50, 'The number of seats')
  }

  if (Object.keys(patch).length === 1) throw new Refused('Nothing to change')

  const after = one(
    await ctx.db.from('pricing').update(patch).eq('id', true).select().single()
  )

  // The public page reads this at runtime, so it is already live. The rebuild
  // is for the HTML behind it: the figures are also baked into the page a
  // visitor sees before any script runs, and a search engine reads that copy.
  const deployed = await triggerDeploy('pricing changed')

  await ctx.audit({ before, patch, deployed })
  return json({ row: after, deployed })
}

function bounded(value: unknown, min: number, max: number, what: string): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Refused(`${what} has to be between ${min} and ${max}`)
  }
  return n
}
