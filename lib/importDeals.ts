import { supabase } from './supabase'
import { createBrand, getBrands } from './brands'
import { createDeal } from './deals'
import { replaceDeliverables } from './deliverables'
import { replaceStages, defaultStageDrafts } from './dealStages'
import type { Brand, ExtractedDealFields } from '@/types'

// Importing the deals a creator already has (PRODUCT.md §8.2).
//
// "A creator arriving has live deals already. If day one is 'type in all
// eight', she leaves." The extraction already exists for screenshots and voice
// notes; this points it at a spreadsheet, an export, or a photo of her notes,
// and returns candidates for review.
//
// Nothing here saves without confirmation, matching the rule §8.3 sets for
// every other AI path: the model gets things wrong, and a CRM that silently
// invented eight deals would be worse than one that imported none.

export interface ImportCandidate extends ExtractedDealFields {
  /** Stable across a review session, so a row can be toggled and edited. */
  key: string
  /** Set when a brand of this name already exists; the import reuses it. */
  existingBrandId: string | null
}

export interface ImportOutcome {
  imported: number
  /** Rows that failed, with a reason worth showing. */
  failed: { brandName: string; reason: string }[]
}

async function invokeExtractDeals(
  body: { text: string } | { imageBase64: string; mimeType: string }
): Promise<ExtractedDealFields[]> {
  const { data, error } = await supabase.functions.invoke('extract-deals', { body })
  if (error) throw error
  return (data?.deals ?? []) as ExtractedDealFields[]
}

/**
 * Matches an extracted brand name against the ones she already has.
 *
 * Case- and punctuation-insensitive, because a spreadsheet says "Nykaa." and
 * "nykaa" and "Nykaa Beauty" for the same brand. Getting this wrong creates a
 * duplicate brand, which then splits her reputation history and her totals for
 * that brand across two records — a mess that is tedious to undo by hand.
 */
function normalizeBrand(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function matchBrand(name: string | null, brands: Brand[]): string | null {
  if (!name) return null
  const target = normalizeBrand(name)
  if (!target) return null
  return brands.find((b) => normalizeBrand(b.name) === target)?.id ?? null
}

async function toCandidates(deals: ExtractedDealFields[]): Promise<ImportCandidate[]> {
  const brands = await getBrands()
  return deals.map((deal, index) => ({
    ...deal,
    key: `${index}-${deal.brand_name ?? 'unknown'}`,
    existingBrandId: matchBrand(deal.brand_name, brands),
  }))
}

/** A spreadsheet export, or anything else pasted as text. */
export async function extractDealsFromText(text: string): Promise<ImportCandidate[]> {
  return toCandidates(await invokeExtractDeals({ text }))
}

/** A photo or screenshot of a list. */
export async function extractDealsFromImage(
  imageBase64: string,
  mimeType: string
): Promise<ImportCandidate[]> {
  return toCandidates(await invokeExtractDeals({ imageBase64, mimeType }))
}

/**
 * Creates the confirmed rows.
 *
 * Sequential rather than parallel, and each row independent: an import of
 * fifteen deals where the seventh has a brand name the database rejects should
 * import fourteen and say which one it could not, rather than failing whole and
 * leaving her to work out what landed.
 *
 * Each row goes through `createDeal`, so an imported deal gets the payment
 * record, the due-date calculation and the reminders a typed one gets. A
 * thinner insert here would produce deals that look right and never remind her
 * of anything — the worst possible outcome for a CRM whose promise is that she
 * stops missing deadlines.
 */
export async function importDeals(candidates: ImportCandidate[]): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { imported: 0, failed: [] }
  // Refreshed once, then updated as we go: two rows for the same new brand
  // must not create it twice.
  const brands = await getBrands()
  const created = new Map<string, string>()

  for (const candidate of candidates) {
    const brandName = candidate.brand_name?.trim() || 'Unknown brand'

    try {
      const normalized = normalizeBrand(brandName)
      let brandId =
        candidate.existingBrandId ?? matchBrand(brandName, brands) ?? created.get(normalized) ?? null

      if (!brandId) {
        const brand = await createBrand({
          name: brandName,
          contact_person: null,
          contact_phone: null,
          contact_email: null,
          notes: null,
        })
        brandId = brand.id
        created.set(normalized, brandId)
      }

      const deal = await createDeal({
        brand_id: brandId,
        platform: candidate.platform ?? 'instagram_reel',
        deliverable_description: candidate.deliverable_description ?? 'Imported deal',
        // A deal must carry a rate, and the model returns null when the sheet
        // did not say. Zero is the honest placeholder — it reads as "not
        // recorded" on every screen, where a guessed figure would read as fact.
        rate: candidate.rate ?? 0,
        publish_date: candidate.publish_date,
        payment_terms: candidate.payment_terms,
        notes: candidate.notes,
      })

      // The same default workflow a typed deal gets, dated from whatever the
      // sheet knew. Without stages the deal has no deadlines, and the reminders
      // that justify the product never fire for anything imported.
      const stages = defaultStageDrafts()
      if (candidate.publish_date && stages.length > 0) {
        stages[stages.length - 1].due_date = candidate.publish_date
      }
      await replaceStages(deal.id, stages)

      if (candidate.deliverables.length > 0) {
        await replaceDeliverables(
          deal.id,
          candidate.deliverables.map((item) => ({
            kind: item.kind,
            quantity: item.quantity,
            description: item.description,
            rate: item.rate ?? 0,
          }))
        )
      }

      outcome.imported++
    } catch (error) {
      outcome.failed.push({
        brandName,
        reason: error instanceof Error ? error.message : 'Could not import this one',
      })
    }
  }

  return outcome
}
