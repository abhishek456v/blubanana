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


/** Thrown when a brand still has deals against it. */
export class BrandHasDeals extends Error {
  constructor() {
    super('That brand still has deals')
    this.name = 'BrandHasDeals'
  }
}

/**
 * Deletes a brand and its contacts.
 *
 * `deals.brand_id` is `on delete restrict` (migration 001), so the database
 * refuses while any deal still points at the brand. That is the right
 * behaviour and not something to work around: deleting the brand would
 * otherwise take a year of paid work with it. The refusal is turned into a
 * named error so the screen can say which of the two things went wrong.
 *
 * Owner only, by the same policy as deals.
 */
export async function deleteBrand(id: string): Promise<void> {
  const { error } = await supabase.from('brands').delete().eq('id', id)
  if (error) {
    // 23503 is a foreign key violation; here it can only be the deals link.
    if ((error as { code?: string }).code === '23503') throw new BrandHasDeals()
    throw error
  }
}
