import { supabase } from './supabase'
import type { Creator } from '@/types'

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
  fields: Partial<Pick<Creator, 'name' | 'phone' | 'follower_count'>>
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
