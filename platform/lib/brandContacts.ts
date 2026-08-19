import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'
import type { BrandContact } from '@/types'

export interface ContactDraft {
  id?: string
  name: string
  phone: string | null
  email: string | null
  role: string | null
  is_primary: boolean
}

/** Primary first, then oldest first, so the list order is stable across saves. */
export async function getContacts(brandId: string): Promise<BrandContact[]> {
  const { data, error } = await supabase
    .from('brand_contacts')
    .select('*')
    .eq('brand_id', brandId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as BrandContact[]
}

/** The person a nudge should be addressed to, or null if the brand has nobody. */
export function primaryContact(contacts: readonly BrandContact[]): BrandContact | null {
  return contacts.find((contact) => contact.is_primary) ?? contacts[0] ?? null
}

/**
 * Replaces a brand's contacts with exactly what the editor is holding.
 *
 * Same delete-then-insert reasoning as `replaceStages`: contacts are editable
 * and reorderable, a brand has two or three of them, and a per-row diff buys
 * nothing but the chance to attach a phone number to the wrong person.
 *
 * Exactly one contact ends up primary. The database enforces *at most* one via
 * a partial unique index, but it cannot enforce *at least* one, and a brand
 * whose contacts are all non-primary would silently stop receiving nudges. So
 * the choice is normalised here: the first one flagged primary wins, and if the
 * caller flagged none, the first contact is promoted.
 */
export async function replaceContacts(
  brandId: string,
  drafts: ContactDraft[]
): Promise<BrandContact[]> {
  const workspaceId = await getWorkspaceId()

  const usable = drafts.filter(
    (draft) =>
      draft.name.trim().length > 0 ||
      (draft.phone ?? '').trim().length > 0 ||
      (draft.email ?? '').trim().length > 0
  )

  const primaryIndex = Math.max(
    0,
    usable.findIndex((draft) => draft.is_primary)
  )

  const rows = usable.map((draft, index) => ({
    workspace_id: workspaceId,
    brand_id: brandId,
    name: draft.name.trim(),
    phone: draft.phone?.trim() || null,
    email: draft.email?.trim() || null,
    role: draft.role?.trim() || null,
    is_primary: index === primaryIndex,
  }))

  const { error: deleteError } = await supabase
    .from('brand_contacts')
    .delete()
    .eq('brand_id', brandId)
  if (deleteError) throw deleteError

  if (rows.length === 0) return []

  const { data, error } = await supabase.from('brand_contacts').insert(rows).select()
  if (error) throw error
  return (data ?? []) as BrandContact[]
}
