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
// endpoint gets 404 no matter what they put in the body.
//
// This file does the deciding and nothing else. The actions themselves live in
// the modules beside it, and none of them repeats a permission check, because
// nothing reaches them until this has finished.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { Ctx, PlatformRole, Refused, json } from './lib.ts'
import * as insight from './insight.ts'
import * as billing from './billing.ts'
import * as broadcast from './broadcast.ts'
import * as library from './library.ts'
import * as desk from './desk.ts'
import * as writing from './writing.ts'

/**
 * Which roles may run which action. `admin` passes everything and is not
 * listed; an empty list means admin only.
 *
 * An action absent from this table does not exist, whoever is asking. That is
 * what makes adding a handler below insufficient on its own: a new action is
 * unreachable until somebody writes down who it is for.
 */
const ACTION_ACCESS: Record<string, PlatformRole[]> = {
  overview: ['support', 'finance', 'editor'],
  health: ['support'],
  funnel: ['support'],
  people: ['support'],
  activity: ['support'],
  // Looking at one creator's business. Support can, because that is the job;
  // finance and editor cannot, because it is not.
  'people.snapshot': ['support'],

  subscriptions: ['finance'],
  'subscriptions.adjust': ['finance'],
  // What everybody pays. Finance, because that is the whole of that role.
  'pricing.get': ['finance'],
  'pricing.save': ['finance'],

  // Broadcasting is content work, so an editor may do it. Nobody else but an
  // admin: a message on every screen in the product is not a small lever.
  'announcements.list': ['editor'],
  'announcements.save': ['editor'],
  'announcements.delete': ['editor'],

  'media.list': ['editor', 'support'],
  'media.uploadUrl': ['editor'],
  'media.register': ['editor'],
  'media.update': ['editor'],
  'media.delete': ['editor'],
  // Deleting files nothing points at, in bulk. Admin only: it is the one
  // action here that can destroy something nobody asked about.
  'media.sweep': [],

  'support.list': ['support'],
  'support.get': ['support'],
  'support.reply': ['support'],
  'support.update': ['support'],

  // Reading which switches exist is harmless; throwing one is not.
  'flags.list': ['support', 'finance', 'editor'],
  'flags.set': [],

  // The blog is the editor's job, which is what that role is for.
  'blog.list': ['editor'],
  'blog.save': ['editor'],
  'blog.delete': ['editor'],
  'blog.import': ['editor'],
  // Spending a build on purpose, with nothing changed. Admin only, because it
  // is the one action here whose cost is somebody else's bill.
  'site.deploy': [],

  'content.list': ['editor'],
  'content.save': ['editor'],

  // The DPDP register. Admin only, because answering these is a legal duty
  // that sits with the fiduciary rather than with whoever is on shift.
  'data.list': [],
  'data.update': [],

  // Reading what the dashboard itself did. Admin only: it names who looked at
  // whose business, which is not something a support shift needs.
  'admin.audit': [],
}

const HANDLERS: Record<string, (ctx: Ctx) => Promise<Response>> = {
  overview: insight.overview,
  health: insight.health,
  funnel: insight.funnel,
  people: insight.people,
  activity: insight.activity,
  'people.snapshot': desk.snapshot,

  subscriptions: billing.subscriptions,
  'subscriptions.adjust': billing.adjust,
  'pricing.get': billing.pricingGet,
  'pricing.save': billing.pricingSave,

  'announcements.list': broadcast.list,
  'announcements.save': broadcast.save,
  'announcements.delete': broadcast.remove,

  'media.list': library.list,
  'media.uploadUrl': library.uploadUrl,
  'media.register': library.register,
  'media.update': library.update,
  'media.delete': library.remove,
  'media.sweep': library.sweep,

  'support.list': desk.supportList,
  'support.get': desk.supportGet,
  'support.reply': desk.supportReply,
  'support.update': desk.supportUpdate,

  'flags.list': desk.flagsList,
  'flags.set': desk.flagsSet,

  'blog.list': writing.list,
  'blog.save': writing.save,
  'blog.delete': writing.remove,
  'blog.import': writing.importDocx,
  'site.deploy': writing.deploy,

  'content.list': writing.contentList,
  'content.save': writing.contentSave,

  'data.list': desk.dataList,
  'data.update': desk.dataUpdate,

  'admin.audit': insight.adminAudit,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── Who is asking ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'Not signed in' }, 401)

  const { data: userData, error: userError } = await db.auth.getUser(jwt)
  const user = userData?.user
  if (userError || !user) return json({ error: 'Not signed in' }, 401)

  const { data: adminRow } = await db
    .from('platform_admins')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = (adminRow?.role ?? null) as PlatformRole | null

  // Deliberately the same answer as a bad action: someone probing this
  // endpoint learns only that they are not welcome, not which actions exist.
  if (!role) return json({ error: 'Not found' }, 404)

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action ?? '')
  const allowed = ACTION_ACCESS[action]
  const handler = HANDLERS[action]
  if (!allowed || !handler) return json({ error: 'Not found' }, 404)
  if (role !== 'admin' && !allowed.includes(role)) {
    return json({ error: 'Your role does not cover that' }, 403)
  }

  // ── Every action is recorded ──────────────────────────────────────────────
  //
  // Including the reads, not just the writes. A dashboard that can see
  // everyone's money should be able to say what it looked at, and the person
  // most likely to need that record is whoever is reading this later trying to
  // work out what happened.
  //
  // Failure to write the record is swallowed on purpose: an audit table that
  // is full or locked should not take the dashboard down with it.
  const audit = (detail: Record<string, unknown> = {}) =>
    db
      .from('admin_audit_logs')
      .insert({ actor_id: user.id, role, action, detail })
      .then(() => {}, () => {})

  const ctx: Ctx = {
    db,
    user: { id: user.id, email: user.email ?? null },
    role,
    body,
    audit,
  }

  try {
    return await handler(ctx)
  } catch (error) {
    // A Refused is a sentence written for the person on the screen. Anything
    // else is ours, and says nothing: a database error message is a map of the
    // schema, and there is no version of this where showing it helps.
    if (error instanceof Refused) return json({ error: error.message }, error.status)
    console.error('admin function failed', action, error)
    return json({ error: 'Something went wrong on our side' }, 500)
  }
})
