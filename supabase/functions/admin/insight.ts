// The reading half of the dashboard: who signed up, what they are doing, and
// whether anything is quietly broken.
//
// Every query here crosses workspaces, which is exactly what row-level
// security exists to prevent, and exactly why none of it can live in the app.

import { Ctx, count, emailsById, json, rows } from './lib.ts'

export async function overview(ctx: Ctx) {
  const { db } = ctx
  const [workspaces, subs, deals, invoices] = await Promise.all([
    db.from('workspaces').select('id', { count: 'exact', head: true }),
    db.from('subscriptions').select('status'),
    db.from('deals').select('id', { count: 'exact', head: true }),
    db.from('invoices').select('id', { count: 'exact', head: true }),
  ])

  const byStatus: Record<string, number> = {}
  for (const s of rows<{ status: string }>(subs)) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
  }

  await ctx.audit()
  return json({
    workspaces: count(workspaces),
    deals: count(deals),
    invoices: count(invoices),
    subscriptions: byStatus,
  })
}

/**
 * Three things that fail silently today.
 *
 * The statuses are the ones these tables actually use, checked against their
 * constraints rather than guessed. Neither reminders nor outbound_messages has
 * a 'failed' state:
 *
 *   * A reminder that went 'expired' passed its moment without anybody acting
 *     on it, which is the closest thing to a missed nudge.
 *   * A message sitting at 'approved' was cleared to send and never went.
 *     Draft and cancelled are both deliberate and not faults.
 */
export async function health(ctx: Ctx) {
  const { db } = ctx
  const [social, reminders, messages] = await Promise.all([
    db
      .from('social_accounts')
      .select('id, platform, handle, status, last_error, last_synced_at, workspace_id')
      .neq('status', 'active'),
    db
      .from('reminders')
      // `title` matters: without it the screen showed the reminder's *type*,
      // which is a database value ("payment", "workflow") and not a sentence
      // anybody would recognise.
      .select('id, type, title, status, scheduled_for, workspace_id')
      .in('status', ['expired', 'escalated'])
      .order('scheduled_for', { ascending: false })
      .limit(200),
    db
      .from('outbound_messages')
      .select('id, channel, purpose, recipient, status, created_at, workspace_id')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const socialAccounts = rows(social)
  const missedReminders = rows(reminders)
  const stuckMessages = rows(messages)

  // Every row above names a workspace by id, which is unreadable on a screen.
  // Resolving them here keeps the client from needing a second round trip and
  // from ever holding a list of every workspace in the business.
  const names = await workspaceNames(db, [
    ...socialAccounts.map((r) => (r as { workspace_id: string }).workspace_id),
    ...missedReminders.map((r) => (r as { workspace_id: string }).workspace_id),
    ...stuckMessages.map((r) => (r as { workspace_id: string }).workspace_id),
  ])

  await ctx.audit()
  return json({ socialAccounts, missedReminders, stuckMessages, workspaceNames: names })
}

export async function funnel(ctx: Ctx) {
  const { db } = ctx
  const [workspaces, brands, deals, invoices] = await Promise.all([
    db.from('workspaces').select('id, name, created_at'),
    db.from('brands').select('workspace_id'),
    db.from('deals').select('workspace_id'),
    db.from('invoices').select('workspace_id'),
  ])

  const has = (result: Parameters<typeof rows>[0]) =>
    new Set(rows<{ workspace_id: string }>(result).map((r) => r.workspace_id))
  const withBrand = has(brands)
  const withDeal = has(deals)
  const withInvoice = has(invoices)

  const list = rows<{ id: string; name: string; created_at: string }>(workspaces).map((w) => ({
    id: w.id,
    name: w.name,
    created_at: w.created_at,
    brand: withBrand.has(w.id),
    deal: withDeal.has(w.id),
    invoice: withInvoice.has(w.id),
  }))

  await ctx.audit()
  return json({
    total: list.length,
    withBrand: list.filter((r) => r.brand).length,
    withDeal: list.filter((r) => r.deal).length,
    withInvoice: list.filter((r) => r.invoice).length,
    rows: list,
  })
}

/**
 * Everybody using the product, one row each, with a way to reach them.
 *
 * Assembled in memory from five queries rather than one join, because
 * PostgREST cannot express this shape and a database view would have to be
 * kept in step with five tables by hand. At the scale this reports on, the
 * cost is a few hundred rows and one pass over each.
 */
export async function people(ctx: Ctx) {
  const { db } = ctx
  const [workspaces, owners, subs, deals, profiles] = await Promise.all([
    db.from('workspaces').select('id, name, type, timezone, created_at').order('created_at', { ascending: false }),
    db.from('memberships').select('workspace_id, user_id, role, status').eq('role', 'owner'),
    db.from('subscriptions').select('workspace_id, status, billing_term, trial_ends_at, current_period_end, cancelled_at, is_internal'),
    db.from('deals').select('workspace_id'),
    db.from('profiles').select('id, name, phone, follower_count, niche'),
  ])

  const ownerRows = rows<{ workspace_id: string; user_id: string }>(owners)
  const emails = await emailsById(db, ownerRows.map((o) => o.user_id))
  const profileById = new Map(
    rows<{ id: string }>(profiles).map((p) => [p.id, p as Record<string, unknown>])
  )
  const ownerOf = new Map(ownerRows.map((o) => [o.workspace_id, o.user_id]))
  const subOf = new Map(
    rows<{ workspace_id: string }>(subs).map((s) => [s.workspace_id, s as Record<string, unknown>])
  )

  const dealCount = new Map<string, number>()
  for (const d of rows<{ workspace_id: string }>(deals)) {
    dealCount.set(d.workspace_id, (dealCount.get(d.workspace_id) ?? 0) + 1)
  }

  const list = rows<{ id: string; name: string; type: string; created_at: string }>(workspaces).map(
    (w) => {
      const userId = ownerOf.get(w.id) ?? null
      const profile = userId ? profileById.get(userId) : null
      const sub = subOf.get(w.id) ?? null
      return {
        workspace_id: w.id,
        workspace_name: w.name,
        type: w.type,
        created_at: w.created_at,
        user_id: userId,
        name: (profile?.name as string) ?? null,
        email: userId ? (emails[userId] ?? null) : null,
        phone: (profile?.phone as string) ?? null,
        niche: (profile?.niche as string) ?? null,
        followers: (profile?.follower_count as number) ?? null,
        deals: dealCount.get(w.id) ?? 0,
        status: (sub?.status as string) ?? null,
        billing_term: (sub?.billing_term as string) ?? null,
        trial_ends_at: (sub?.trial_ends_at as string) ?? null,
        current_period_end: (sub?.current_period_end as string) ?? null,
        cancelled_at: (sub?.cancelled_at as string) ?? null,
        is_internal: (sub?.is_internal as boolean) ?? false,
      }
    }
  )

  await ctx.audit({ people: list.length })
  return json({ rows: list })
}

/**
 * What has been happening, from the log that has been filling up all along.
 *
 * `audit_logs` already had hundreds of rows before anything could read them.
 * This is a screen over data that existed, not a feature that needed building.
 */
export async function activity(ctx: Ctx) {
  const { db } = ctx
  const workspaceId = ctx.body.workspace_id ? String(ctx.body.workspace_id) : null

  let query = db
    .from('audit_logs')
    .select('id, workspace_id, actor_user_id, entity_type, entity_id, action, changes, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const list = rows<{ workspace_id: string; actor_user_id: string }>(await query)
  const [names, profiles] = await Promise.all([
    workspaceNames(db, list.map((r) => r.workspace_id)),
    db.from('profiles').select('id, name'),
  ])
  const actorNames: Record<string, string> = {}
  for (const p of rows<{ id: string; name: string }>(profiles)) actorNames[p.id] = p.name

  await ctx.audit({ workspace_id: workspaceId })
  return json({ rows: list, workspaceNames: names, actorNames })
}

/** id -> name, for however many workspace ids a screen happens to mention. */
async function workspaceNames(db: Ctx['db'], ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return {}
  const list = rows<{ id: string; name: string }>(
    await db.from('workspaces').select('id, name').in('id', unique)
  )
  const map: Record<string, string> = {}
  for (const w of list) map[w.id] = w.name
  return map
}
