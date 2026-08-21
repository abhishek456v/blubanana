// The desk: things people ask for, switches to pull, and the register of
// requests the law obliges us to answer.

import { Ctx, Refused, count, emailsById, json, one, oneOf, rows, str } from './lib.ts'

const TICKET_STATUSES = ['new', 'open', 'waiting', 'closed'] as const
const PRIORITIES = ['low', 'normal', 'high'] as const
const REQUEST_STATUSES = ['new', 'in_progress', 'done', 'refused'] as const

// ── Support ──────────────────────────────────────────────────────────────────

export async function supportList(ctx: Ctx) {
  const status = ctx.body.status ? String(ctx.body.status) : null

  let query = ctx.db
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)
  // "open" on this screen means anything not finished, which is three
  // statuses. The alternative is a filter that hides the new ones, which is
  // the opposite of useful.
  if (status === 'open') query = query.neq('status', 'closed')
  else if (status && status !== 'all') query = query.eq('status', status)

  const list = rows<{ workspace_id: string | null }>(await query)
  const names = await namesFor(ctx, list.map((t) => t.workspace_id))

  const waiting = count(
    await ctx.db
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'closed')
  )

  await ctx.audit({ status, tickets: list.length })
  return json({ rows: list, workspaceNames: names, openCount: waiting })
}

export async function supportGet(ctx: Ctx) {
  const id = str(ctx.body, 'id')
  const ticket = one(await ctx.db.from('support_tickets').select('*').eq('id', id).maybeSingle())
  const notes = rows(
    await ctx.db
      .from('support_ticket_notes')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
  )

  const authorIds = (notes as { author_id: string | null }[])
    .map((n) => n.author_id)
    .filter(Boolean) as string[]
  const emails = await emailsById(ctx.db, authorIds)

  await ctx.audit({ id })
  return json({ ticket, notes, authorEmails: emails })
}

/**
 * A reply the creator sees, or a note only the dashboard does.
 *
 * The ticket's status follows from who spoke last, which a trigger handles, so
 * that a reply sent from anywhere keeps the list honest about who is waiting
 * for whom.
 */
export async function supportReply(ctx: Ctx) {
  const ticketId = str(ctx.body, 'ticket_id')
  const body = str(ctx.body, 'body')
  const isInternal = Boolean(ctx.body.is_internal)

  const note = one(
    await ctx.db
      .from('support_ticket_notes')
      .insert({ ticket_id: ticketId, author_id: ctx.user.id, is_internal: isInternal, body })
      .select()
      .single()
  )

  await ctx.audit({ ticket_id: ticketId, internal: isInternal })
  return json({ note })
}

export async function supportUpdate(ctx: Ctx) {
  const id = str(ctx.body, 'id')
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (ctx.body.status !== undefined) {
    const status = oneOf(ctx.body.status, TICKET_STATUSES, 'open')
    patch.status = status
    patch.closed_at = status === 'closed' ? new Date().toISOString() : null
  }
  if (ctx.body.priority !== undefined) patch.priority = oneOf(ctx.body.priority, PRIORITIES, 'normal')
  if (ctx.body.assigned_to !== undefined) {
    patch.assigned_to = ctx.body.assigned_to ? String(ctx.body.assigned_to) : null
  }

  const row = one(await ctx.db.from('support_tickets').update(patch).eq('id', id).select().single())
  await ctx.audit({ id, patch })
  return json({ row })
}

// ── Feature switches ─────────────────────────────────────────────────────────

export async function flagsList(ctx: Ctx) {
  const list = rows(await ctx.db.from('feature_flags').select('*').order('key'))
  await ctx.audit()
  return json({ rows: list })
}

export async function flagsSet(ctx: Ctx) {
  const key = str(ctx.body, 'key')
  const enabled = Boolean(ctx.body.enabled)

  const row = one(
    await ctx.db
      .from('feature_flags')
      .update({ enabled, updated_by: ctx.user.id, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()
      .single()
  )

  // Worth reading back in a year: this is the record of who turned Instagram
  // off the night it broke, and when it came back.
  await ctx.audit({ key, enabled })
  return json({ row })
}

// ── Data requests ────────────────────────────────────────────────────────────

export async function dataList(ctx: Ctx) {
  const list = rows<{ workspace_id: string | null }>(
    await ctx.db
      .from('data_requests')
      .select('*')
      .order('due_at', { ascending: true })
      .limit(300)
  )
  const names = await namesFor(ctx, list.map((r) => r.workspace_id))
  await ctx.audit({ requests: list.length })
  return json({ rows: list, workspaceNames: names })
}

export async function dataUpdate(ctx: Ctx) {
  const id = str(ctx.body, 'id')
  const status = oneOf(ctx.body.status, REQUEST_STATUSES, 'in_progress')
  const patch: Record<string, unknown> = {
    status,
    completed_at: status === 'done' || status === 'refused' ? new Date().toISOString() : null,
  }
  if (ctx.body.note !== undefined) patch.note = ctx.body.note ? String(ctx.body.note) : null

  const row = one(await ctx.db.from('data_requests').update(patch).eq('id', id).select().single())
  await ctx.audit({ id, status })
  return json({ row })
}

// ── What one creator actually has ────────────────────────────────────────────

/**
 * A read-only look at one workspace, for when somebody writes in saying their
 * deals have vanished.
 *
 * Deliberately not a way to sign in as them. A magic link would be less code
 * and would let an admin do anything the creator can do, including things the
 * creator would never have done, in a session that looks exactly like theirs
 * in every other log. This can answer the question that gets asked, which is
 * always "what is actually there", and cannot change a single row.
 */
export async function snapshot(ctx: Ctx) {
  const workspaceId = str(ctx.body, 'workspace_id')
  const { db } = ctx

  const [workspace, owner, brands, deals, invoices, payments, reminders, social] =
    await Promise.all([
    db.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
    db
      .from('memberships')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')
      .maybeSingle(),
    db.from('brands').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    db
      .from('deals')
      .select('id, deliverable_description, platform, status, rate, created_at, brand_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('invoices').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    db
      .from('payments')
      .select('amount, amount_received, status, due_date')
      .eq('workspace_id', workspaceId)
      .limit(500),
    db
      .from('reminders')
      .select('id, type, status, scheduled_for')
      .eq('workspace_id', workspaceId)
      .order('scheduled_for', { ascending: false })
      .limit(10),
    db.from('social_accounts').select('platform, handle, status').eq('workspace_id', workspaceId),
  ])

  // Whoever this workspace belongs to, and how to reach them. The reason
  // somebody opens this screen is almost always to write back afterwards.
  const ownerId = (owner.data as { user_id?: string } | null)?.user_id ?? null
  const emails = ownerId ? await emailsById(db, [ownerId]) : {}
  const profile = ownerId
    ? (await db.from('profiles').select('name, phone').eq('id', ownerId).maybeSingle()).data
    : null

  // Rupees, not paise. The creator's own money is stored in whole rupees
  // throughout this product; only the subscription tables use paise. Mixing
  // the two is a factor of a hundred, in public, on somebody's earnings.
  const paymentRows = rows<{ amount: number; amount_received: number | null; status: string }>(
    payments
  )
  const received = paymentRows
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount_received ?? p.amount ?? 0), 0)
  const pending = paymentRows
    .filter((p) => p.status !== 'paid')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)

  // Recorded with the workspace named, because looking at somebody's business
  // is the single most sensitive thing this dashboard can do and the record of
  // it should be impossible to miss.
  await ctx.audit({ workspace_id: workspaceId, looked_at: 'snapshot' })

  return json({
    workspace: one(workspace),
    owner: ownerId
      ? {
          user_id: ownerId,
          name: ((profile as { name?: string } | null)?.name ?? '').trim() || null,
          email: emails[ownerId] ?? null,
          phone: (profile as { phone?: string } | null)?.phone ?? null,
        }
      : null,
    brands: count(brands),
    invoices: count(invoices),
    deals: rows(deals),
    reminders: rows(reminders),
    social: rows(social),
    receivedRupees: received,
    pendingRupees: pending,
  })
}

/** Workspace id -> name, for any list that mentions some. */
async function namesFor(ctx: Ctx, ids: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[]
  if (unique.length === 0) return {}
  const list = rows<{ id: string; name: string }>(
    await ctx.db.from('workspaces').select('id, name').in('id', unique)
  )
  const map: Record<string, string> = {}
  for (const w of list) map[w.id] = w.name
  return map
}
