// Deletes the calling user's account, and everything that is theirs.
//
// §8.18: a real deletion path, not a cancellation. This is a DPDP Act 2023
// obligation — the app stores brand contacts' names and phone numbers, which
// is third-party personal data — so "delete" has to mean the rows are gone.
//
// It runs as an edge function because only the service role can remove a row
// from auth.users; the client cannot delete its own account no matter how the
// UI is written.
//
// Authentication is the caller's own JWT, verified twice over: the gateway
// checks it before this runs (this function is absent from config.toml, so it
// keeps the default verify_jwt), and getUser() below resolves it to the user
// actually being deleted. There is no user id in the request body on purpose —
// accepting one would make this an "delete any account" endpoint guarded only
// by whatever check we remembered to write.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'attachments'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  const user = userData?.user
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── 1. Which workspaces are actually hers ────────────────────────────────
    // Only the ones she owns. A workspace she manages for someone else is not
    // hers to delete, and her membership in it disappears with her profile.
    const { data: owned, error: ownedError } = await admin
      .from('memberships')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')

    if (ownedError) throw ownedError
    const workspaceIds = (owned ?? []).map((m) => m.workspace_id as string)

    // ── 2. Hand back what belongs to other people ────────────────────────────
    // Before anything is deleted. Every business table carries `creator_id
    // references profiles on delete cascade`, so a manager's rows in someone
    // else's workspace would be destroyed by the auth delete at the end — the
    // creator losing deals because her assistant closed their account.
    const { error: reassignError } = await admin.rpc(
      'reassign_creator_rows_for_deletion',
      { target: user.id }
    )
    if (reassignError) throw reassignError

    // ── 3. Stored files ──────────────────────────────────────────────────────
    // Storage has no foreign keys, so nothing cascades here: the objects would
    // outlive every row that referenced them. Paths are
    // `<workspace_id>/<deal_id>/<file>`, so this walks two levels.
    for (const workspaceId of workspaceIds) {
      const { data: dealFolders } = await admin.storage.from(BUCKET).list(workspaceId)

      for (const folder of dealFolders ?? []) {
        // Storage returns a placeholder entry with a null id for an empty
        // folder; it has no object to remove.
        if (folder.id !== null) {
          await admin.storage.from(BUCKET).remove([`${workspaceId}/${folder.name}`])
          continue
        }

        const { data: files } = await admin.storage
          .from(BUCKET)
          .list(`${workspaceId}/${folder.name}`)

        const paths = (files ?? [])
          .filter((f) => f.id !== null)
          .map((f) => `${workspaceId}/${folder.name}/${f.name}`)

        if (paths.length > 0) {
          await admin.storage.from(BUCKET).remove(paths)
        }
      }
    }

    // ── 4. The workspaces ────────────────────────────────────────────────────
    // This is the delete that clears the data: every business table is
    // `workspace_id ... on delete cascade`. Deleting the auth user alone would
    // leave the workspace row and anything in it a manager had created.
    if (workspaceIds.length > 0) {
      const { error: workspaceError } = await admin
        .from('workspaces')
        .delete()
        .in('id', workspaceIds)
      if (workspaceError) throw workspaceError
    }

    // ── 5. The account ───────────────────────────────────────────────────────
    // Cascades to profiles, and from there to memberships and push tokens.
    // Last, so a failure above leaves an account that can still sign in and
    // try again rather than orphaned data with no owner to delete it.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ deleted: true, workspaces: workspaceIds.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('delete-account failed', error)
    return new Response(
      JSON.stringify({ error: 'Could not complete the deletion' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
