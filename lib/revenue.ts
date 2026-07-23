import type { DealWithPaymentSummary } from './deals'

// Revenue dashboard (Phase 2) — every number here is derived client-side
// from deals + payments already being fetched elsewhere. No new schema, no
// new API calls; this is purely a different view of existing data.

export interface RevenueSummary {
  earnedThisMonth: number
  pendingPayment: number
  averageDealValue: number
  dealsClosed: number
  bestPayingBrand: { name: string; total: number } | null
  monthlyTotals: { label: string; total: number }[] // oldest → newest, 6 months
}

function isSameMonth(dateStr: string, ref: Date): boolean {
  const [year, month] = dateStr.split('-').map(Number)
  return year === ref.getFullYear() && month - 1 === ref.getMonth()
}

export function computeRevenueSummary(deals: DealWithPaymentSummary[]): RevenueSummary {
  const now = new Date()

  const paidDeals = deals.filter((d) => d.payment?.status === 'paid' && d.payment.paid_date)

  const earnedThisMonth = paidDeals
    .filter((d) => isSameMonth(d.payment!.paid_date!, now))
    .reduce((sum, d) => sum + (d.payment?.amount ?? d.rate), 0)

  const pendingPayment = deals
    .filter((d) => d.payment && d.payment.status !== 'paid')
    .reduce((sum, d) => sum + (d.payment?.amount ?? 0), 0)

  const averageDealValue = deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + d.rate, 0) / deals.length) : 0

  const dealsClosed = paidDeals.length

  const byBrand = new Map<string, number>()
  for (const d of paidDeals) {
    const name = d.brand?.name ?? 'Unknown brand'
    byBrand.set(name, (byBrand.get(name) ?? 0) + (d.payment?.amount ?? d.rate))
  }
  let bestPayingBrand: RevenueSummary['bestPayingBrand'] = null
  for (const [name, total] of byBrand) {
    if (!bestPayingBrand || total > bestPayingBrand.total) bestPayingBrand = { name, total }
  }

  const monthlyTotals: RevenueSummary['monthlyTotals'] = []
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const total = paidDeals
      .filter((d) => isSameMonth(d.payment!.paid_date!, ref))
      .reduce((sum, d) => sum + (d.payment?.amount ?? d.rate), 0)
    monthlyTotals.push({ label: ref.toLocaleDateString('en-IN', { month: 'short' }), total })
  }

  return { earnedThisMonth, pendingPayment, averageDealValue, dealsClosed, bestPayingBrand, monthlyTotals }
}
