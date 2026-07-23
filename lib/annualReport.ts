import type { DealWithPaymentSummary } from './deals'
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

export interface AnnualReport {
  fyLabel: string
  totalRevenue: number
  dealsClosed: number
  bestClient: { name: string; total: number } | null
  worstClient: { name: string; averageRating: number } | null
  gstCollected: number
  tdsDeducted: number
  paymentsResolved: number
}

export function computeAnnualReport(
  deals: DealWithPaymentSummary[],
  invoices: Invoice[],
  ratings: BrandRating[],
  fyStartYear: number
): AnnualReport {
  const paidInFY = deals.filter(
    (d) => d.payment?.status === 'paid' && d.payment.paid_date && inFinancialYear(d.payment.paid_date, fyStartYear)
  )

  const totalRevenue = paidInFY.reduce((sum, d) => sum + (d.payment?.amount ?? d.rate), 0)

  const byBrand = new Map<string, number>()
  for (const d of paidInFY) {
    const name = d.brand?.name ?? 'Unknown brand'
    byBrand.set(name, (byBrand.get(name) ?? 0) + (d.payment?.amount ?? d.rate))
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

  return {
    fyLabel: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
    totalRevenue,
    dealsClosed: paidInFY.length,
    bestClient,
    worstClient,
    gstCollected,
    tdsDeducted,
    paymentsResolved: paidInFY.length,
  }
}
