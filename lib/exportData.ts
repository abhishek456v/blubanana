import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'

/**
 * Everything a creator has, as one JSON document.
 *
 * Two reasons this exists, and the second is not optional. It is a trust
 * signal on a paid product — she can leave with her records. And CreatorDesk
 * stores brand contacts' names and phone numbers, which is third-party
 * personal data, making the business a Data Fiduciary under India's Digital
 * Personal Data Protection Act 2023; portability is a duty, not a courtesy.
 *
 * Available during the read-only state after a lapsed subscription too. Locking
 * someone out of their own records and then refusing to hand them over is the
 * one behaviour that would make the trial gate indefensible.
 */
export interface ExportBundle {
  exported_at: string
  workspace_id: string
  profile: unknown
  brands: unknown[]
  brand_contacts: unknown[]
  deals: unknown[]
  deal_stages: unknown[]
  deal_deliverables: unknown[]
  payments: unknown[]
  invoices: unknown[]
  invoice_line_items: unknown[]
  brand_ratings: unknown[]
  expenses: unknown[]
}

/** Tables pulled wholesale. RLS scopes each to the caller's workspace. */
const TABLES = [
  'brands',
  'brand_contacts',
  'deals',
  'deal_stages',
  'deal_deliverables',
  'payments',
  'invoices',
  'invoice_line_items',
  'brand_ratings',
  'expenses',
] as const

export async function buildExport(): Promise<ExportBundle> {
  const workspaceId = await getWorkspaceId()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const bundle: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    workspace_id: workspaceId,
    profile,
  }

  // Sequential rather than parallel. An export is a rare, deliberate action,
  // and ten simultaneous full-table reads is a good way to be rate-limited
  // halfway through and hand back a partial file that looks complete.
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`Could not export ${table}: ${error.message}`)
    bundle[table] = data ?? []
  }

  // Deliberately absent: push_tokens (device identifiers, useless to her),
  // outbound_messages and audit_logs (operational, and the audit log records
  // who changed what, which is ours rather than hers).
  return bundle as unknown as ExportBundle
}

/**
 * One table as CSV.
 *
 * Spreadsheets are what a creator actually opens, and what an accountant asks
 * for. The JSON bundle is the complete record; this is the readable slice.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''

  // Union of keys, not the first row's: Supabase returns nulls for missing
  // columns, but a row-shape difference would otherwise silently truncate.
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]

  const escape = (value: unknown): string => {
    if (value == null) return ''
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    // Quote when the value contains a delimiter, a quote or a newline, and
    // double any embedded quotes. Without this a note containing a comma
    // silently shifts every later column in that row.
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(',')),
  ].join('\n')
}
