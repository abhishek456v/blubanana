import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'
import type { Deliverable, DeliverableKind, Platform } from '@/types'
import {
  COMMERCIAL_KINDS,
  DEFAULT_PLATFORM_FOR_KIND,
  DELIVERABLE_LABELS,
} from '@/constants/labels'

// Deliverables are the line items on a deal: a reel, three stories, the ad
// rights. RLS scopes every query to the caller's workspaces, so none of these
// filter by workspace manually on read.

export interface DeliverableInput {
  kind: DeliverableKind
  platform?: Platform | null
  quantity?: number
  description?: string | null
  rate?: number
  due_date?: string | null
  live_link?: string | null
  published_at?: string | null
  duration_months?: number | null
  starts_on?: string | null
  expires_on?: string | null
}

export async function getDeliverables(dealId: string): Promise<Deliverable[]> {
  const { data, error } = await supabase
    .from('deal_deliverables')
    .select('*')
    .eq('deal_id', dealId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Deliverable[]
}

/** All deliverables across a set of deals, grouped by deal id. */
export async function getDeliverablesForDeals(
  dealIds: string[]
): Promise<Map<string, Deliverable[]>> {
  const grouped = new Map<string, Deliverable[]>()
  if (dealIds.length === 0) return grouped

  const { data, error } = await supabase
    .from('deal_deliverables')
    .select('*')
    .in('deal_id', dealIds)
    .order('sort_order', { ascending: true })

  if (error) throw error

  for (const row of (data ?? []) as Deliverable[]) {
    const existing = grouped.get(row.deal_id)
    if (existing) existing.push(row)
    else grouped.set(row.deal_id, [row])
  }
  return grouped
}

/**
 * Replaces a deal's deliverables wholesale and re-syncs the deal's rate.
 *
 * A diff (insert new / update changed / delete removed) would save writes, but
 * the editor lets rows be reordered, split and merged freely, so identity is
 * not stable between renders. Deleting and re-inserting keeps the stored list
 * exactly what the creator sees, and a deal has a handful of rows, not
 * hundreds.
 */
export async function replaceDeliverables(
  dealId: string,
  items: DeliverableInput[]
): Promise<Deliverable[]> {
  const { error: deleteError } = await supabase
    .from('deal_deliverables')
    .delete()
    .eq('deal_id', dealId)

  if (deleteError) throw deleteError

  let inserted: Deliverable[] = []

  if (items.length > 0) {
    const workspaceId = await getWorkspaceId()
    const rows = items.map((item, index) => ({
      workspace_id: workspaceId,
      deal_id: dealId,
      kind: item.kind,
      // Commercial add-ons have no platform; a stale one left over from a
      // kind change would show "Ad rights · Reel" in the UI.
      platform: COMMERCIAL_KINDS.includes(item.kind)
        ? null
        : (item.platform ?? DEFAULT_PLATFORM_FOR_KIND[item.kind]),
      quantity: item.quantity ?? 1,
      description: item.description ?? null,
      rate: item.rate ?? 0,
      due_date: item.due_date ?? null,
      live_link: item.live_link ?? null,
      published_at: item.published_at ?? null,
      duration_months: item.kind === 'ad_rights' ? (item.duration_months ?? null) : null,
      starts_on: item.kind === 'ad_rights' ? (item.starts_on ?? null) : null,
      expires_on: item.kind === 'ad_rights' ? (item.expires_on ?? null) : null,
      sort_order: index,
    }))

    const { data, error } = await supabase.from('deal_deliverables').insert(rows).select()
    if (error) throw error
    inserted = (data ?? []) as Deliverable[]
  }

  await syncDealFromDeliverables(dealId, items)
  return inserted
}

/**
 * Human summary of the line items: "Reel + Story ×3".
 *
 * Ad rights are left out: they are a licence term, not something the creator
 * makes, and including them reads oddly in the places this string surfaces
 * (list rows, invoice descriptions, the WhatsApp delivery message). If the
 * deal is *only* ad rights, they go back in rather than returning an empty
 * string into a NOT NULL column.
 */
export function summarizeDeliverables(items: DeliverableInput[]): string {
  const describe = (item: DeliverableInput) => {
    const label = DELIVERABLE_LABELS[item.kind]
    const quantity = item.quantity ?? 1
    return quantity > 1 ? `${label} ×${quantity}` : label
  }

  const content = items.filter((item) => item.kind !== 'ad_rights')
  const source = content.length > 0 ? content : items
  return source.map(describe).join(' + ')
}

/**
 * Writes the deal's headline rate as the sum of its content deliverables.
 *
 * Ad rights are excluded. That fee has always been stored and reported
 * separately from `deals.rate`; folding it in here would silently change
 * every historical revenue figure the creator has already seen. `totalDealValue`
 * below is what surfaces the combined number in the UI.
 *
 * Done explicitly rather than in a database trigger: a money column rewritten
 * by something invisible at the call site is exactly the kind of change that
 * should be greppable.
 */
export async function syncDealFromDeliverables(
  dealId: string,
  items: DeliverableInput[]
): Promise<void> {
  // A deal whose only line item is ad rights would otherwise be forced to a
  // rate of 0, wiping a figure the creator entered by hand.
  const contentItems = items.filter((item) => item.kind !== 'ad_rights')
  if (contentItems.length === 0) return

  const { error } = await supabase
    .from('deals')
    .update({
      rate: contentItems.reduce((sum, item) => sum + (item.rate ?? 0), 0),
      // Everything built before deliverables existed (list rows, invoice
      // descriptions, the WhatsApp delivery message) still reads this single
      // text field, so it is kept as a rendering of the real line items rather
      // than left to drift.
      deliverable_description: summarizeDeliverables(items),
    })
    .eq('id', dealId)

  if (error) throw error
}

/** Content fee plus any ad-rights fee: what the brand actually pays. */
export function totalDealValue(deliverables: Deliverable[]): number {
  return deliverables.reduce((sum, d) => sum + d.rate, 0)
}

export function contentValue(deliverables: Deliverable[]): number {
  return deliverables
    .filter((d) => d.kind !== 'ad_rights')
    .reduce((sum, d) => sum + d.rate, 0)
}

export interface AdRightsBreakdown {
  totalFee: number
  months: number
  /** Rounded to the rupee; this is a negotiating aid, not an invoice line. */
  perMonth: number
  expiresOn: string | null
}

/**
 * Splits an ad-rights fee across its licence period.
 *
 * Requested directly: "if the duration is 6 months and the price is 20K, tell
 * me how much I'm charging monthly". It is the number that makes an ad-rights
 * quote comparable to the next brand's offer, and nothing in the app derived
 * it before.
 *
 * Returns null unless both a fee and a duration exist: a per-month figure
 * computed from a missing duration would be a fabricated number on a screen
 * about money.
 */
export function adRightsBreakdown(deliverable: Deliverable): AdRightsBreakdown | null {
  if (deliverable.kind !== 'ad_rights') return null

  const months = deliverable.duration_months ?? 0
  if (months <= 0 || deliverable.rate <= 0) return null

  return {
    totalFee: deliverable.rate,
    months,
    perMonth: Math.round(deliverable.rate / months),
    expiresOn: deliverable.expires_on,
  }
}

/** Same calculation from raw form values, for live feedback while typing. */
export function adRightsPerMonth(fee: number | null, months: number | null): number | null {
  if (!fee || !months || months <= 0 || fee <= 0) return null
  return Math.round(fee / months)
}

/**
 * Ad-rights expiry from a start date and a duration.
 *
 * Stored rather than derived at read time so the expiry reminder has a stable
 * date to schedule against, matching how `deals.ad_rights_expires_date`
 * already behaves.
 */
export function adRightsExpiry(startsOn: string | null, months: number | null): string | null {
  if (!startsOn || !months || months <= 0) return null

  const [year, month, day] = startsOn.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  start.setMonth(start.getMonth() + months)

  const mm = String(start.getMonth() + 1).padStart(2, '0')
  const dd = String(start.getDate()).padStart(2, '0')
  return `${start.getFullYear()}-${mm}-${dd}`
}

/** Human summary for a row: "Story ×3", "Reel", "Ad rights · 6 months". */
export function describeDeliverable(deliverable: Deliverable, label: string): string {
  if (deliverable.kind === 'ad_rights' && deliverable.duration_months) {
    return `${label} · ${deliverable.duration_months} months`
  }
  return deliverable.quantity > 1 ? `${label} ×${deliverable.quantity}` : label
}
