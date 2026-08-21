// The admin dashboard's only door to data.
//
// Deno edge function. Deploy with: supabase functions deploy admin
//
// ── Why everything goes through here ────────────────────────────────────────
//
// Admin screens read across every workspace, which is precisely what row-level
// security exists to prevent. The way to do that safely is not to widen RLS,
// because a policy that lets one person see everything is a policy that has to
// be right about who that person is on every table, for ever. It is to keep
// RLS exactly as strict as it is and put the cross-workspace reads on the
// server, where the caller cannot reach them.
//
// So the browser never holds a key that can read another creator's business.
// It holds its own session, sends it here, and this decides.
//
// ── How the caller is identified ────────────────────────────────────────────
//
// From the JWT, verified by Supabase, never from anything the client says
// about itself. The role is then read from `platform_admins`, a table the
// authenticated role has no privileges on whatsoever. A creator calling this
// endpoint gets 403 no matter what they put in the body.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type PlatformRole = 'admin' | 'support' | 'finance' | 'editor'

/** Which roles may run which action. `admin` passes everything and is not listed. */
const ACTION_ACCESS: Record<string, PlatformRole[]> = {
  overview: ['support', 'finance', 'editor'],
  health: ['support'],
  funnel: ['support'],
  subscriptions: ['finance'],
  // Broadcasting is content work, so an editor may do it. Nobody else but an
  // admin: a message on every screen in the product is not a small lever.
  'announcements.list': ['editor'],
  'announcements.save': ['editor'],
  'announcements.delete': ['editor'],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── Who is asking ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'Not signed in' }, 401)

  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  const user = userData?.user
  if (userError || !user) return json({ error: 'Not signed in' }, 401)

  const { data: adminRow } = await admin
    .from('platform_admins')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = (adminRow?.role ?? null) as PlatformRole | null

  // Deliberately the same answer as a bad action: someone probing this
  // endpoint learns only that they are not welcome, not which actions exist.
  if (!role) return json({ error: 'Not found' }, 404)

  const body = (await req.json().catch(() => ({}))) as { action?: string }
  const action = body.action ?? ''
  const allowed = ACTION_ACCESS[action]
  if (!allowed) return json({ error: 'Not found' }, 404)
  if (role !== 'admin' && !allowed.includes(role)) {
    return json({ error: 'Your role does not cover that' }, 403)
  }

  // ── Every read is recorded ────────────────────────────────────────────────
  //
  // Including the reads, not just the writes. A dashboard that can see
  // everyone's money should be able to say what it looked at, and the person
  // most likely to need that record is whoever is reading this later trying to
  // work out what happened.
  const audit = (detail: Record<string, unknown> = {}) =>
    admin
      .from('admin_audit_logs')
      .insert({ actor_id: user.id, role, action, detail })
      .then(() => {}, () => {})

  try {
    if (action === 'overview') {
      const [workspaces, subs, deals, invoices] = await Promise.all([
        admin.from('workspaces').select('id', { count: 'exact', head: true }),
        admin.from('subscriptions').select('status'),
        admin.from('deals').select('id', { count: 'exact', head: true }),
        admin.from('invoices').select('id', { count: 'exact', head: true }),
      ])
      const byStatus: Record<string, number> = {}
      for (const s of subs.data ?? []) {
        byStatus[(s as { status: string }).status] =
          (byStatus[(s as { status: string }).status] ?? 0) + 1
      }
      await audit()
      return json({
        workspaces: workspaces.count ?? 0,
        deals: deals.count ?? 0,
        invoices: invoices.count ?? 0,
        subscriptions: byStatus,
      })
    }

    if (action === 'health') {
      // Three things that fail silently today. Each is already recorded and
      // none is watched, so the first anyone hears of a failure is a creator
      // asking why their figures stopped moving.
      //
      // The statuses here are the ones these tables actually use, checked
      // against their constraints rather than guessed. Neither reminders nor
      // outbound_messages has a 'failed' state:
      //
      //   * A reminder that went 'expired' passed its moment without anybody
      //     acting on it, which is the closest thing to a missed nudge.
      //   * A message sitting at 'approved' was cleared to send and never
      //     went. Draft and cancelled are both deliberate and not faults.
      const [social, reminders, messages] = await Promise.all([
        admin
          .from('social_accounts')
          .select('platform, handle, status, last_error, workspace_id')
          .neq('status', 'active'),
        admin
          .from('reminders')
          .select('id, type, status, scheduled_for, workspace_id')
          .in('status', ['expired', 'escalated'])
          .order('scheduled_for', { ascending: false })
          .limit(50),
        admin
          .from('outbound_messages')
          .select('id, channel, purpose, status, created_at, workspace_id')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(50),
      ])
      await audit()
      return json({
        socialAccounts: social.data ?? [],
        missedReminders: reminders.data ?? [],
        stuckMessages: messages.data ?? [],
      })
    }

    if (action === 'funnel') {
      // Signed up, added a brand, added a deal, raised an invoice. The number
      // that matters most for a product with a trial, and the one nothing
      // currently reports: two of the three workspaces that exist have never
      // created a deal.
      const [workspaces, brands, deals, invoices] = await Promise.all([
        admin.from('workspaces').select('id, name, created_at'),
        admin.from('brands').select('workspace_id'),
        admin.from('deals').select('workspace_id'),
        admin.from('invoices').select('workspace_id'),
      ])
      const has = (rows: { workspace_id: string }[] | null) =>
        new Set((rows ?? []).map((r) => r.workspace_id))
      const withBrand = has(brands.data as never)
      const withDeal = has(deals.data as never)
      const withInvoice = has(invoices.data as never)

      const rows = (workspaces.data ?? []).map((w) => {
        const ws = w as { id: string; name: string; created_at: string }
        return {
          id: ws.id,
          name: ws.name,
          created_at: ws.created_at,
          brand: withBrand.has(ws.id),
          deal: withDeal.has(ws.id),
          invoice: withInvoice.has(ws.id),
        }
      })
      await audit()
      return json({
        total: rows.length,
        withBrand: rows.filter((r) => r.brand).length,
        withDeal: rows.filter((r) => r.deal).length,
        withInvoice: rows.filter((r) => r.invoice).length,
        rows,
      })
    }

    if (action === 'announcements.list') {
      // Everything, drafts included. The public policy only exposes published
      // rows inside their window, which is exactly why the admin screen has to
      // come through here to see the rest.
      const { data } = await admin
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      await audit()
      return json({ rows: data ?? [] })
    }

    if (action === 'announcements.save') {
      const input = (body as { announcement?: Record<string, unknown> }).announcement ?? {}
      const title = String(input.title ?? '').trim()
      if (!title) return json({ error: 'Give it a title' }, 400)

      // Only these columns, listed rather than spread. A spread would let a
      // crafted body set `created_by` to somebody else, or set columns added
      // later that nobody thought about when writing this.
      const row = {
        kind: input.kind ?? 'banner',
        title,
        body: input.body ?? null,
        surface: input.surface ?? 'both',
        audience: input.audience ?? 'everyone',
        link_url: input.link_url ?? null,
        link_label: input.link_label ?? null,
        dismissible: input.dismissible ?? true,
        starts_at: input.starts_at ?? new Date().toISOString(),
        ends_at: input.ends_at ?? null,
        published: input.published ?? false,
        updated_at: new Date().toISOString(),
      }

      const id = input.id ? String(input.id) : null
      const { data, error } = id
        ? await admin.from('announcements').update(row).eq('id', id).select().single()
        : await admin
            .from('announcements')
            .insert({ ...row, created_by: user.id })
            .select()
            .single()

      if (error) return json({ error: error.message }, 400)
      await audit({ id: data?.id, title, published: row.published })
      return json({ row: data })
    }

    if (action === 'announcements.delete') {
      const id = String((body as { id?: string }).id ?? '')
      if (!id) return json({ error: 'Which one' }, 400)
      const { error } = await admin.from('announcements').delete().eq('id', id)
      if (error) return json({ error: error.message }, 400)
      await audit({ id })
      return json({ ok: true })
    }

    if (action === 'subscriptions') {
      const { data } = await admin
        .from('subscriptions')
        .select('id, workspace_id, status, term, current_period_end, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      await audit()
      return json({ rows: data ?? [] })
    }

    return json({ error: 'Not found' }, 404)
  } catch (error) {
    console.error('admin function failed', action, error)
    return json({ error: 'Something went wrong on our side' }, 500)
  }
})
