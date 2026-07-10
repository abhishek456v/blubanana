import { supabase } from './supabase'
import type { Brand } from '@/types'

// RLS on the brands table restricts reads to the authenticated user's rows automatically.

export async function getBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data as Brand[]
}

export async function createBrand(
  input: Pick<Brand, 'name' | 'contact_person' | 'contact_phone' | 'contact_email' | 'notes'>
): Promise<Brand> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('brands')
    .insert({ ...input, creator_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data as Brand
}

// Minimal update path — there's no dedicated brand-edit screen yet, this
// exists solely so the deal screen can fill in a missing contact_phone
// inline when a WhatsApp payment reminder needs one (PRODUCT.md 2.4).
export async function updateBrand(
  id: string,
  fields: Partial<Pick<Brand, 'contact_phone'>>
): Promise<Brand> {
  const { data, error } = await supabase.from('brands').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data as Brand
}
