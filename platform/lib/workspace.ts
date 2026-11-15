import { supabase } from './supabase'

// The tenant is a workspace, not a user (migration 009).
//
// Every insert has to carry a workspace_id, and from migration 010 the column
// is NOT NULL with RLS keyed off workspace membership, so a row written
// without one is rejected by the database rather than silently misfiled.
//
// Reads do not need this: the RLS policies resolve the caller's workspace from
// auth.uid() themselves, so a plain `select` already returns only rows the
// signed-in user is entitled to.
//
// A person can belong to more than one workspace: her own, and any she has
// been invited to manage. Migration 052 makes the database work in exactly one
// at a time, and this module is where the app learns which, and changes it.

/**
 * Cached because it is needed on the hot path of every write. Cleared on
 * sign-out so the next account does not inherit the previous one's workspace:
 * the single most damaging thing this module could get wrong. Cleared on a
 * switch for the same reason.
 */
let cachedWorkspaceId: string | null = null
let cachedForUserId: string | null = null

/**
 * Bumped on every switch. The signed-in screens are keyed on it, so a switch
 * remounts them and every list reads again from the new workspace; nothing has
 * to remember to refetch.
 */
let version = 0
const listeners = new Set<() => void>()

export function clearWorkspaceCache(): void {
  cachedWorkspaceId = null
  cachedForUserId = null
}

export function subscribeWorkspace(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getWorkspaceVersion(): number {
  return version
}

function announceChange(): void {
  version += 1
  listeners.forEach((listener) => listener())
}

/**
 * The workspace the signed-in user is working in, as the database sees it.
 *
 * Asked of the database rather than worked out here, so that what a write is
 * filed under and what the policies let through can never disagree.
 */
export async function getWorkspaceId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Keyed on the user id as well as the value, so a sign-out/sign-in that
  // somehow skips clearWorkspaceCache still cannot serve a stale workspace.
  if (cachedWorkspaceId && cachedForUserId === user.id) return cachedWorkspaceId

  const { data, error } = await supabase.rpc('auth_active_workspace_id')

  if (error) throw error
  if (!data) {
    // The signup trigger creates a workspace alongside the profile, so this
    // means either the trigger did not run or migration 009 was never applied.
    throw new Error('No workspace found for this account')
  }

  cachedWorkspaceId = data as string
  cachedForUserId = user.id
  return cachedWorkspaceId
}

/** The user id and their workspace, for inserts that still write both. */
export async function getWriteContext(): Promise<{ userId: string; workspaceId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return { userId: user.id, workspaceId: await getWorkspaceId() }
}

export interface WorkspaceChoice {
  workspaceId: string
  /** 'owner' for her own, 'manager' for one she was invited into. */
  role: string
  /** Null when the creator has not filled in a name yet. */
  ownerName: string | null
  isActive: boolean
}

/** Every workspace the signed-in user belongs to, her own first. */
export async function listWorkspaces(): Promise<WorkspaceChoice[]> {
  const { data, error } = await supabase.rpc('my_workspaces')
  if (error) throw error

  return (
    (data ?? []) as {
      workspace_id: string
      role: string
      owner_name: string | null
      is_active: boolean
    }[]
  ).map((row) => ({
    workspaceId: row.workspace_id,
    role: row.role,
    ownerName: row.owner_name,
    isActive: row.is_active,
  }))
}

/**
 * Moves the signed-in user into another workspace she belongs to.
 *
 * The database refuses a workspace she is not in, and the choice is stored on
 * her profile, so it holds on her other devices too. The cache is dropped
 * before anybody is told, or the first screen to remount would still file
 * writes under the workspace she just left.
 */
export async function switchWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.rpc('set_active_workspace', { p_workspace: workspaceId })
  if (error) throw error

  clearWorkspaceCache()
  announceChange()
}

/**
 * Re-reads which workspace is active after something that can change it behind
 * the app's back, which today is only claiming an invite. Announces a change
 * only when there was one, so a launch that claims nothing remounts nothing.
 */
export async function refreshWorkspace(): Promise<void> {
  const before = cachedWorkspaceId
  clearWorkspaceCache()
  const after = await getWorkspaceId()
  if (before && before !== after) announceChange()
}
