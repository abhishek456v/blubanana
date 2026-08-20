import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'
import { primaryContact } from './brandContacts'
import type { Brand, BrandContact } from '@/types'

/**
 * The person to address, for a brand read through `getBrands`/`getBrand`.
 *
 * Every screen that wants a brand's name, phone or email goes through this.
 * They used to read `brand.contact_person` and friends directly, which had
 * been returning undefined since migration 022 dropped those columns, silently
 * and everywhere: blank contacts in the brand list, an empty invoice header,
 * and a WhatsApp button on deal detail with no number behind it.
 */
export function brandContact(brand: Pick<Brand, 'brand_contacts'>): BrandContact | null {
  return primaryContact(brand.brand_contacts ?? [])
}

// RLS on the brands table restricts reads to the authenticated user's rows automatically.

export async function getBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from('brands')
    .select('*, brand_contacts(*)')
    .order('name', { ascending: true })

  if (error) throw error
  return data as Brand[]
}

// Contacts are written separately, through lib/brandContacts. Both callers
// already do that; they were also passing the three dropped columns here, and
// PostgREST rejects the whole insert when one column is unknown, so creating
// a brand failed outright rather than saving a brand without its contact.
export async function createBrand(
  input: Pick<Brand, 'name' | 'notes'>
): Promise<Brand> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('brands')
    .insert({ ...input, workspace_id: await getWorkspaceId() })
    .select()
    .single()

  if (error) throw error
  return data as Brand
}

export async function getBrand(id: string): Promise<Brand> {
  const { data, error } = await supabase
    .from('brands')
    .select('*, brand_contacts(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Brand
}

export async function updateBrand(
  id: string,
  fields: Partial<Pick<Brand, 'name' | 'notes'>>
): Promise<Brand> {
  const { data, error } = await supabase.from('brands').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data as Brand
}
