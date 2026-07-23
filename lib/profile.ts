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

// Random unguessable slug, not the raw profile UUID — public_creator_profiles
// (migration 006) is keyed on this so the internal id never appears in a
// shared URL. 10 base36 chars ≈ 51 bits of entropy, plenty for a media-kit
// link that isn't protecting anything sensitive (the view only exposes name/
// niche/follower count/deals completed/platforms).
function generateShareSlug(): string {
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
}

export async function enablePublicProfile(): Promise<Creator> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .update({ public_profile_enabled: true, public_share_slug: generateShareSlug() })
    .eq('id', user.id)
    .select()
    .single()
  if (error) throw error
  return data as Creator
}

export interface PublicCreatorProfile {
  public_share_slug: string
  name: string
  niche: string | null
  follower_count: number | null
  deals_completed: number
  platforms: Platform[] | null
}

// Reads from the public_creator_profiles VIEW (migration 006), not the
// profiles table — works with no session at all, since that view is
// grant-select'd to the anon role and already filters to opted-in creators
// only. Used by the unauthenticated app/creator/[slug].tsx route.
export async function getPublicCreatorProfile(slug: string): Promise<PublicCreatorProfile | null> {
  const { data, error } = await supabase
    .from('public_creator_profiles')
    .select('*')
    .eq('public_share_slug', slug)
    .maybeSingle()
  if (error) throw error
  return data as PublicCreatorProfile | null
}

export async function disablePublicProfile(): Promise<Creator> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Slug is cleared, not just the enabled flag, so re-enabling later issues
  // a fresh link rather than silently reviving an old one someone might
  // still have saved.
  const { data, error } = await supabase
    .from('profiles')
    .update({ public_profile_enabled: false, public_share_slug: null })
    .eq('id', user.id)
    .select()
    .single()
  if (error) throw error
  return data as Creator
}
