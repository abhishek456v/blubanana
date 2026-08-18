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
      | 'niche'
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
