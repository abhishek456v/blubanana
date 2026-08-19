import { supabase } from './supabase'
import { formatCurrency } from './format'
import type { Brand, Deal, Invoice } from '@/types'

// Global search across the three things a creator looks for by name: a deal
// ("what was that Nyka one?"), a brand, or an invoice number.
//
// Queried server-side rather than by filtering an already-fetched list. The
// client only ever holds the current screen's rows, so a client-side search
// would quietly search a subset and report "no match" for records that exist,
// the worst possible failure for a search box.

export type SearchResultKind = 'deal' | 'brand' | 'invoice'

export interface SearchResult {
  kind: SearchResultKind
  id: string
  title: string
  /** One line of context: the brand, the amount, the status. */
  subtitle: string
  /** Sort key: lower wins. Exact prefix matches float to the top. */
  rank: number
}

/** Below this a query matches most of the table and the results are noise. */
const MIN_QUERY_LENGTH = 2

/** Per-kind cap, so one busy table cannot crowd the others out. */
const PER_KIND_LIMIT = 6

/**
 * Escapes a user's text for a PostgREST `ilike` pattern.
 *
 * `%` and `_` are wildcards, and a comma would terminate the argument inside an
 * `.or()` filter list: a brand called "Nykaa, Inc" would otherwise produce a
 * malformed query rather than a search.
 */
function escapePattern(query: string): string {
  return query.replace(/[%_\\]/g, (ch) => `\\${ch}`).replace(/,/g, ' ')
}

function rankOf(haystack: string, needle: string): number {
  const a = haystack.toLowerCase()
  const b = needle.toLowerCase()
  if (a === b) return 0
  if (a.startsWith(b)) return 1
  return 2
}

export async function search(rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim()
  if (query.length < MIN_QUERY_LENGTH) return []

  const pattern = `%${escapePattern(query)}%`

  // Each table is queried independently and failures are swallowed per-table:
  // invoices arrived in a later migration than deals, so one being unavailable
  // should still let the other two answer. (PostgREST builders are PromiseLike
  // without .catch, hence the wrapper.)
  async function rows<T>(builder: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    try {
      const { data, error } = await builder
      return error ? [] : (data ?? [])
    } catch {
      return []
    }
  }

  const DEAL_SELECT = 'id, deliverable_description, rate, status, brand:brands(name)'

  // Deals are matched two ways, as two queries: by their own text, and by
  // their brand's name: "what was that Nyka one?" is a deal question, and
  // text-only matching answered it with just the brand row. Two queries
  // because PostgREST cannot OR across the parent and an embedded table in
  // one filter: a top-level .or() plus a referencedTable .or() would AND
  // together, and referencedTable alone would look the deal columns up on
  // `brands`.
  const [dealsByText, dealsByBrand, brands, invoices] = await Promise.all([
    rows(
      supabase
        .from('deals_secure')
        .select(DEAL_SELECT)
        .or(`deliverable_description.ilike.${pattern},notes.ilike.${pattern}`)
        .limit(PER_KIND_LIMIT)
    ),
    rows(
      supabase
        .from('deals_secure')
        // !inner so the brand filter narrows the deals; over a left join it
        // would return every deal with the non-matching brands nulled out.
        .select('id, deliverable_description, rate, status, brand:brands!inner(name)')
        .ilike('brands.name', pattern)
        .limit(PER_KIND_LIMIT)
    ),
    rows(
      supabase
        .from('brands')
        .select('id, name, contact_person, contact_email')
        .or(
          `name.ilike.${pattern},contact_person.ilike.${pattern},contact_email.ilike.${pattern}`
        )
        .limit(PER_KIND_LIMIT)
    ),
    rows(
      supabase
        .from('invoices')
        .select('id, invoice_number, brand_name, total_amount')
        .ilike('invoice_number', pattern)
        .limit(PER_KIND_LIMIT)
    ),
  ])

  // Merged by id, since a deal whose description and brand both match arrives twice.
  const dealById = new Map<string, (typeof dealsByText)[number]>()
  for (const deal of [...dealsByBrand, ...dealsByText]) {
    dealById.set((deal as { id: string }).id, deal)
  }
  const deals = [...dealById.values()].slice(0, PER_KIND_LIMIT)

  const results: SearchResult[] = []

  for (const brand of brands as Pick<
    Brand,
    'id' | 'name' | 'contact_person' | 'contact_email'
  >[]) {
    results.push({
      kind: 'brand',
      id: brand.id,
      title: brand.name,
      subtitle:
        [brand.contact_person, brand.contact_email].filter(Boolean).join(' · ') || 'Brand',
      rank: rankOf(brand.name, query),
    })
  }

  // Through `unknown` because supabase-js, without generated DB types, infers
  // every embedded relation as an array; at runtime a to-one embed over the
  // deals.brand_id foreign key is a single object (lib/deals.ts relies on the
  // same behaviour).
  for (const deal of deals as unknown as (Pick<
    Deal,
    'id' | 'deliverable_description' | 'rate' | 'status'
  > & { brand: { name: string } | null })[]) {
    const brandName = deal.brand?.name ?? 'Unknown brand'
    results.push({
      kind: 'deal',
      id: deal.id,
      title: brandName,
      subtitle: deal.deliverable_description || 'Deal',
      // Whichever path matched better: a deal found via its brand's name
      // should rank like that name, not like its unrelated description.
      rank: Math.min(rankOf(deal.deliverable_description ?? '', query), rankOf(brandName, query)),
    })
  }

  for (const invoice of invoices as Pick<
    Invoice,
    'id' | 'invoice_number' | 'brand_name' | 'total_amount'
  >[]) {
    results.push({
      kind: 'invoice',
      id: invoice.id,
      title: invoice.invoice_number,
      subtitle: `${invoice.brand_name} · ${formatCurrency(invoice.total_amount)}`,
      rank: rankOf(invoice.invoice_number, query),
    })
  }

  // Brands before deals before invoices at equal rank: searching a name is
  // the common case, and the brand is the thing the deals hang off.
  const kindOrder: Record<SearchResultKind, number> = { brand: 0, deal: 1, invoice: 2 }
  return results.sort(
    (a, b) => a.rank - b.rank || kindOrder[a.kind] - kindOrder[b.kind] || a.title.localeCompare(b.title)
  )
}
