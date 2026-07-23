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

export async function getBrand(id: string): Promise<Brand> {
  const { data, error } = await supabase.from('brands').select('*').eq('id', id).single()
  if (error) throw error
  return data as Brand
}

export async function updateBrand(
  id: string,
  fields: Partial<Pick<Brand, 'name' | 'contact_person' | 'contact_phone' | 'contact_email' | 'notes'>>
): Promise<Brand> {
  const { data, error } = await supabase.from('brands').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data as Brand
}
