import { supabase } from './supabase'

// The tenant is a workspace, not a user (migration 009).
//
// Every insert has to carry a workspace_id, and from migration 010 the column
// is NOT NULL with RLS keyed off workspace membership, so a row written
// without one is rejected by the database rather than silently misfiled.
//
// Reads do not need this: the RLS policies resolve the caller's workspaces
// from auth.uid() themselves, so a plain `select` already returns only rows the
// signed-in user is entitled to.

/**
 * Cached because it is needed on the hot path of every write and, for a solo
 * creator, never changes within a session. Cleared on sign-out so the next
 * account does not inherit the previous one's workspace: the single most
 * damaging thing this module could get wrong.
 */
let cachedWorkspaceId: string | null = null
let cachedForUserId: string | null = null

export function clearWorkspaceCache(): void {
  cachedWorkspaceId = null
  cachedForUserId = null
}

/**
 * The workspace the signed-in user writes into.
 *
 * Today every user owns exactly one, so this takes the earliest active
 * membership. When multiple workspaces per user become real, this is the single
 * place that has to learn about a "current workspace" selection; every caller
 * already goes through it.
 */
export async function getWorkspaceId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Keyed on the user id as well as the value, so a sign-out/sign-in that
  // somehow skips clearWorkspaceCache still cannot serve a stale workspace.
  if (cachedWorkspaceId && cachedForUserId === user.id) return cachedWorkspaceId

  const { data, error } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    // The signup trigger creates a workspace alongside the profile, so this
    // means either the trigger did not run or migration 009 was never applied.
    throw new Error('No workspace found for this account')
  }

  const workspaceId = data.workspace_id as string
  cachedWorkspaceId = workspaceId
  cachedForUserId = user.id
  return workspaceId
}

/** The user id and their workspace, for inserts that still write both. */
export async function getWriteContext(): Promise<{ userId: string; workspaceId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return { userId: user.id, workspaceId: await getWorkspaceId() }
}
