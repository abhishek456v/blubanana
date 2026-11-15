import { supabase } from './supabase'
import type { Creator, Platform } from '@/types'

// RLS on profiles restricts reads/writes to the authenticated user's own row.

export async function getProfile(): Promise<Creator> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (error) throw error
  return data as Creator
}

/**
 * What an invoice or a response to "who is this for" is built from: the profile
 * of the person who OWNS the workspace being worked in.
 *
 * Not the same as getProfile() the moment somebody manages another creator's
 * work. Then getProfile() is the manager's own row, and printing it on the
 * creator's invoice put the wrong GSTIN, the wrong UPI id and the wrong bank
 * account on a document going to a brand (found 15 Nov 2026).
 *
 * Fields the signed-in member is not allowed to see arrive as null, and the two
 * flags say which group was withheld (migration 053). The owner is always
 * allowed everything, so for a solo creator this is exactly getProfile().
 */
export interface WorkspaceProfile extends Creator {
  invoicing_hidden: boolean
  payment_hidden: boolean
}

export async function getWorkspaceProfile(): Promise<WorkspaceProfile> {
  const { data, error } = await supabase.rpc('workspace_owner_profile')
  if (error) throw error
  const row = ((data ?? []) as WorkspaceProfile[])[0]
  if (!row) throw new Error('No profile found for this workspace')
  return row
}

export async function updateProfile(
  fields: Partial<
    Pick<
      Creator,
      | 'name'
      | 'phone'
      | 'follower_count'
      | 'upi_id'
      | 'bank_account_number'
      | 'ifsc_code'
      | 'gstin'
      | 'pan'
      | 'address'
      | 'niche'
      | 'card_theme'
      | 'card_photo_id'
    >
  >
): Promise<Creator> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', user.id)
    .select()
    .single()
  if (error) throw error
  return data as Creator
}

// Random unguessable slug, not the raw profile UUID: public_creator_profiles
// (migration 006) is keyed on this so the internal id never appears in a
// shared URL. 10 base36 chars ≈ 51 bits of entropy, plenty for a media-kit
