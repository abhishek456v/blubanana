import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'

// The manager invite (PRODUCT.md §7).
//
// A membership cannot hold an invite — `memberships.user_id` references
// `profiles`, so there is no row to write until the invitee has an account.
// Invites therefore live in `workspace_invites`, keyed by email, and become
// memberships when `claim_pending_invites()` runs at launch (migration 024).

/**
 * The seven areas a creator grants per manager, in the order the spec lists
 * them and the order the invite screen shows them.
 *
 * `key` matches both the `memberships` column and the area name that
 * `auth_workspace_ids_allowing()` understands, so a rename is one edit.
 */
export const PERMISSION_AREAS = [
  { key: 'can_see_deals', area: 'deals', label: 'Deals and deadlines' },
  { key: 'can_see_brands', area: 'brands', label: 'Brands and contacts' },
  { key: 'can_see_rates', area: 'rates', label: 'Rates and commercials' },
  { key: 'can_see_invoices', area: 'invoices', label: 'Invoices' },
  { key: 'can_see_money', area: 'money', label: 'Money dashboard and reports' },
  { key: 'can_see_expenses', area: 'expenses', label: 'Expenses' },
  { key: 'can_see_banking', area: 'banking', label: 'Bank and billing details' },
] as const

export type PermissionKey = (typeof PERMISSION_AREAS)[number]['key']

export type Permissions = Record<PermissionKey, boolean>

/**
 * What an invite grants unless the creator says otherwise: the work, not the
 * money. Matches the column defaults in 023 — an invite that silently handed
 * over bank details would be the wrong way round.
 */
export const DEFAULT_PERMISSIONS: Permissions = {
  can_see_deals: true,
  can_see_brands: true,
  can_see_rates: false,
  can_see_invoices: false,
  can_see_money: false,
  can_see_expenses: false,
  can_see_banking: false,
}

export const FULL_PERMISSIONS: Permissions = {
  can_see_deals: true,
  can_see_brands: true,
  can_see_rates: true,
  can_see_invoices: true,
  can_see_money: true,
  can_see_expenses: true,
  can_see_banking: true,
}

export type MemberRole = 'owner' | 'manager' | 'editor' | 'viewer'

export interface TeamMember extends Permissions {
  /** Membership id, not user id. This is what update and remove take. */
  id: string
  user_id: string
  role: MemberRole
  status: 'active' | 'invited' | 'suspended'
  /** Null when the lookup found no auth user, which should not happen. */
  email: string | null
  created_at: string
}

export interface PendingInvite extends Permissions {
  id: string
  email: string
  role: MemberRole
  created_at: string
}

/**
 * Converts any invite addressed to the signed-in user into a membership.
 *
 * Idempotent and cheap, and called on app launch rather than only at sign-up:
 * a creator can invite someone who already has an account, and that person
 * would otherwise never pick the invite up.
 *
 * Failure is deliberately swallowed by callers — an invite that does not
 * resolve should not block someone getting into their own workspace.
 */
export async function claimPendingInvites(): Promise<number> {
  const { data, error } = await supabase.rpc('claim_pending_invites')
  if (error) throw error
  return (data as number) ?? 0
}

/** Members of the current workspace, owner first, then by join date. */
export async function getTeam(): Promise<TeamMember[]> {
  const workspaceId = await getWorkspaceId()

  const [members, emails] = await Promise.all([
    supabase
      .from('memberships')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true }),
    supabase.rpc('workspace_member_emails'),
  ])

  if (members.error) throw members.error
  // A non-owner gets an empty set from the function rather than an error, so a
  // failure here is a real one and worth surfacing.
  if (emails.error) throw emails.error

  const emailByUser = new Map<string, string>(
    ((emails.data ?? []) as { user_id: string; email: string }[]).map((row) => [
      row.user_id,
      row.email,
    ])
  )

  return ((members.data ?? []) as TeamMember[])
    .map((m) => ({ ...m, email: emailByUser.get(m.user_id) ?? null }))
    .sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1
      if (b.role === 'owner' && a.role !== 'owner') return 1
      return a.created_at.localeCompare(b.created_at)
    })
}

/** Invites sent but not yet accepted. */
export async function getPendingInvites(): Promise<PendingInvite[]> {
  const workspaceId = await getWorkspaceId()

  const { data, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PendingInvite[]
}

/**
 * Invites a manager by email.
 *
 * The address is lowercased here as well as in the database, because the
 * unique index is on `lower(email)` and a duplicate should be reported as
 * "already invited" rather than as a constraint violation.
 */
export async function inviteManager(
  email: string,
  permissions: Permissions
): Promise<PendingInvite> {
  const workspaceId = await getWorkspaceId()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const normalized = email.trim().toLowerCase()

  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      email: normalized,
      role: 'manager',
      invited_by: user.id,
      ...permissions,
    })
    .select()
    .single()

  if (error) {
    // 23505 is the pending-invite unique index. The generic message names the
    // constraint, which means nothing to a creator.
    if (error.code === '23505') {
      throw new Error(`${normalized} has already been invited.`)
    }
    throw error
  }
  return data as PendingInvite
}

/** Changes what an existing member can see. Takes a membership id. */
export async function updateMemberAccess(
  membershipId: string,
  permissions: Permissions
): Promise<void> {
  const { error } = await supabase
    .from('memberships')
    .update({ ...permissions, updated_at: new Date().toISOString() })
    .eq('id', membershipId)

  if (error) throw error
}

/**
 * Removes a member from the workspace.
 *
 * Their data stays: rows carry `workspace_id`, not a per-member owner, so
 * nothing a manager entered disappears when their access is withdrawn.
 */
export async function removeMember(membershipId: string): Promise<void> {
  const { error } = await supabase.from('memberships').delete().eq('id', membershipId)
  if (error) throw error
}

/** Withdraws an invite that has not been accepted. */
export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('workspace_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)

  if (error) throw error
}

/**
 * The signed-in user's own access.
 *
 * The owner gets everything; the database says the same thing independently,
 * so a UI that got this wrong would hide things rather than expose them.
 */
export async function getMyAccess(): Promise<{
  isOwner: boolean
  permissions: Permissions
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const workspaceId = await getWorkspaceId()

  const { data, error } = await supabase
    .from('memberships')
    .select('role, ' + PERMISSION_AREAS.map((a) => a.key).join(', '))
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) return { isOwner: false, permissions: DEFAULT_PERMISSIONS }

  const row = data as unknown as { role: MemberRole } & Permissions
  const isOwner = row.role === 'owner'

  return {
    isOwner,
    permissions: isOwner
      ? FULL_PERMISSIONS
      : (Object.fromEntries(
          PERMISSION_AREAS.map((a) => [a.key, row[a.key] ?? false])
        ) as Permissions),
  }
}
