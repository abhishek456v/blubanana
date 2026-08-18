import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'
import { paymentsInOrder, type DealWithPaymentSummary } from './deals'
import type { Invoice, BrandRating } from '@/types'

// Indian financial year: April 1 → March 31. fyStartYear=2025 means
// FY 2025-26 (Apr 2025 → Mar 2026).
export function currentFinancialYearStart(): number {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

function inFinancialYear(dateStr: string, fyStartYear: number): boolean {
  const [year, month] = dateStr.split('-').map(Number)
  const fyMonthIndex = month - 4 // April = 0
  const effectiveYear = fyMonthIndex >= 0 ? year : year - 1
  return effectiveYear === fyStartYear
}

/**
 * What the app never saw (§8.13, migration 034).
 *
 * AdSense, affiliate income, a barter deal, an expense paid in cash, TDS
 * entries sitting in Form 26AS from a brand that never invoiced through here.
 * Kept as separate figures rather than as edits to the totals, so the report
 * can always show which side a number came from — see `AnnualReport`.
 *
 * Negative values are allowed and meaningful: a refund is a correction
 * downward.
 */
export interface AnnualAdjustments {
  otherIncome: number
  otherExpenses: number
  otherTds: number
  otherGst: number
  note: string | null
}

export const EMPTY_ADJUSTMENTS: AnnualAdjustments = {
  otherIncome: 0,
  otherExpenses: 0,
  otherTds: 0,
  otherGst: 0,
  note: null,
}

export function hasAdjustments(adjustments: AnnualAdjustments): boolean {
  return (
    adjustments.otherIncome !== 0 ||
    adjustments.otherExpenses !== 0 ||
    adjustments.otherTds !== 0 ||
    adjustments.otherGst !== 0
  )
}

export interface AnnualReport {
  fyLabel: string
  totalRevenue: number
  dealsClosed: number
  bestClient: { name: string; total: number } | null
  worstClient: { name: string; averageRating: number } | null
  gstCollected: number
  tdsDeducted: number
  paymentsResolved: number
  /** What the work cost. Zero when nothing has been logged. */
  totalExpenses: number
  /**
   * Revenue minus expenses: the figure the creator is actually taxed on.
   *
   * Reporting turnover as though it were income is the single most misleading
   * thing a "tax-ready" summary can do — a creator who billed ₹14L and paid an
   * editor ₹3L of it does not owe tax on ₹14L.
   */
  netIncome: number

  /**
   * What she added by hand, and the totals including it.
   *
   * Both sides are kept, never merged. An editable total would let a typo
   * silently replace a figure the app can prove, and neither she nor her
   * accountant would ever know it had — which is the same failure as reporting
   * turnover as income, one level down.
   */
  adjustments: AnnualAdjustments
  adjustedRevenue: number
  adjustedExpenses: number
  adjustedNetIncome: number
  adjustedTdsDeducted: number
  adjustedGstCollected: number
}

/** Loads this workspace's corrections for one financial year. */
export async function getAdjustments(fyStartYear: number): Promise<AnnualAdjustments> {
  const { data, error } = await supabase
    .from('annual_report_adjustments')
    .select('other_income, other_expenses, other_tds, other_gst, note')
    .eq('workspace_id', await getWorkspaceId())
    .eq('fy_start_year', fyStartYear)
    .maybeSingle()

  if (error) throw error
  if (!data) return EMPTY_ADJUSTMENTS

  return {
    otherIncome: data.other_income ?? 0,
    otherExpenses: data.other_expenses ?? 0,
    otherTds: data.other_tds ?? 0,
    otherGst: data.other_gst ?? 0,
    note: data.note ?? null,
  }
}

/** Saves them. One row per workspace per year, so this upserts. */
export async function saveAdjustments(
  fyStartYear: number,
  adjustments: AnnualAdjustments
): Promise<void> {
  const { error } = await supabase.from('annual_report_adjustments').upsert(
    {
      workspace_id: await getWorkspaceId(),
      fy_start_year: fyStartYear,
      other_income: Math.round(adjustments.otherIncome),
      other_expenses: Math.round(adjustments.otherExpenses),
      other_tds: Math.round(adjustments.otherTds),
      other_gst: Math.round(adjustments.otherGst),
      note: adjustments.note?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,fy_start_year' }
  )

  if (error) throw error
}

export function computeAnnualReport(
  deals: DealWithPaymentSummary[],
  invoices: Invoice[],
  ratings: BrandRating[],
  expenses: readonly { spent_on: string; amount: number }[],
  fyStartYear: number,
  adjustments: AnnualAdjustments = EMPTY_ADJUSTMENTS
): AnnualReport {
  const paidInFY = deals.filter(
    (d) =>
      paymentsInOrder(d).some(
        (payment) =>
          payment.status === 'paid' &&
          payment.paid_date &&
          inFinancialYear(payment.paid_date, fyStartYear)
      )
  )

  // Per payment, and the received figure where recorded: a brand that
  // withheld TDS paid less than it was invoiced, and the tax return needs the
  // gross while the bank reconciliation needs the net.
  const settledInFY = (deal: (typeof paidInFY)[number]) =>
    paymentsInOrder(deal).filter(
      (payment) =>
        payment.status === 'paid' &&
        payment.paid_date &&
        inFinancialYear(payment.paid_date, fyStartYear)
    )

  const totalRevenue = paidInFY.reduce(
    (sum, d) =>
      sum + settledInFY(d).reduce((n, p) => n + (p.amount_received ?? p.amount), 0),
    0
  )

  const byBrand = new Map<string, number>()
  for (const d of paidInFY) {
    const name = d.brand?.name ?? 'Unknown brand'
    byBrand.set(
      name,
      (byBrand.get(name) ?? 0) +
        settledInFY(d).reduce((n, p) => n + (p.amount_received ?? p.amount), 0)
    )
  }
  let bestClient: AnnualReport['bestClient'] = null
  for (const [name, total] of byBrand) {
    if (!bestClient || total > bestClient.total) bestClient = { name, total }
  }

  const ratingsInFY = ratings.filter((r) => inFinancialYear(r.created_at.split('T')[0], fyStartYear))
  const ratingsByBrand = new Map<string, number[]>()
  for (const r of ratingsInFY) {
    const list = ratingsByBrand.get(r.brand_id) ?? []
    list.push(r.rating)
    ratingsByBrand.set(r.brand_id, list)
  }
  let worstClient: AnnualReport['worstClient'] = null
  for (const d of deals) {
    const list = d.brand_id ? ratingsByBrand.get(d.brand_id) : null
    if (!list || !d.brand) continue
    const avg = list.reduce((a, b) => a + b, 0) / list.length
    if (!worstClient || avg < worstClient.averageRating) worstClient = { name: d.brand.name, averageRating: avg }
  }

  const invoicesInFY = invoices.filter((inv) => inFinancialYear(inv.invoice_date, fyStartYear))
  const gstCollected = invoicesInFY.reduce((sum, inv) => sum + (inv.gst_applicable ? inv.gst_amount : 0), 0)
  const tdsDeducted = invoicesInFY.reduce((sum, inv) => sum + (inv.tds_deducted ? inv.tds_amount ?? 0 : 0), 0)

  // The same April-to-March window the revenue figures use, so the two sides
  // of the subtraction cover the same period.
  const fyFrom = `${fyStartYear}-04-01`
  const fyTo = `${fyStartYear + 1}-03-31`
  const totalExpenses = expenses
    .filter((e) => e.spent_on >= fyFrom && e.spent_on <= fyTo)
    .reduce((sum, e) => sum + e.amount, 0)

  const adjustedRevenue = totalRevenue + adjustments.otherIncome
  const adjustedExpenses = totalExpenses + adjustments.otherExpenses

  return {
    fyLabel: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    dealsClosed: paidInFY.length,
    bestClient,
    worstClient,
    gstCollected,
    tdsDeducted,
    paymentsResolved: paidInFY.length,

    adjustments,
    adjustedRevenue,
    adjustedExpenses,
    // Recomputed from the adjusted sides rather than added onto netIncome:
    // an adjustment to expenses has to subtract, and adding a signed total
    // would get that wrong the first time someone logs a cash expense.
    adjustedNetIncome: adjustedRevenue - adjustedExpenses,
    adjustedTdsDeducted: tdsDeducted + adjustments.otherTds,
    adjustedGstCollected: gstCollected + adjustments.otherGst,
  }
}
