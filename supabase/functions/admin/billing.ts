// Subscriptions: who is paying, who is about to stop, and the four levers for
// putting something right.
//
// The levers matter more than the list. A creator whose card failed on the day
// of a shoot does not want a refund policy, she wants the thing to keep
// working while she sorts it out, and the difference between a good week and a
// bad one is whether that takes a click or a database console.

import { Ctx, Refused, json, one, oneOf, rows, str } from './lib.ts'

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
