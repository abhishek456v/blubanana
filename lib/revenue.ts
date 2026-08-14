import type { DealWithPaymentSummary } from './deals'
import { getPaymentAlertTone } from './paymentReminders'

// Revenue dashboard — every number here is derived client-side from deals +
// payments already being fetched elsewhere. No new schema, no new API calls;
// this is purely a different view of existing data.

/** A count and a rupee total, the pair almost every figure on Money reports. */
export interface MoneyBucket {
  count: number
  value: number
}

export interface RevenueSummary {
  /**
   * Deals signed this month and what they are worth.
   *
   * This is the number that says whether the month is going well, and it says
   * it *now* — earnings only show up 45 to 90 days after the work, so a
   * dashboard built on received payments alone reports on a quarter already
   * gone. Keyed off `created_at`, which is when the deal was logged; the
   * schema has no separate "confirmed" timestamp to key off instead.
   */
  lockedThisMonth: MoneyBucket
  /** Payments actually received this calendar month. */
  earnedThisMonth: MoneyBucket
  /** Everything billed or expected and not yet received. */
  pending: MoneyBucket
  /** The subset of pending that is already past its due date. */
  overdue: MoneyBucket
  averageDealValue: number
  dealsClosed: number
  bestPayingBrand: { name: string; total: number } | null
  /** Oldest → newest, six months. */
  monthlyTotals: { label: string; total: number }[]
}

function isSameMonth(dateStr: string, ref: Date): boolean {
  const [year, month] = dateStr.split('-').map(Number)
  return year === ref.getFullYear() && month - 1 === ref.getMonth()
}

export function computeRevenueSummary(deals: DealWithPaymentSummary[]): RevenueSummary {
  const now = new Date()

  const paidDeals = deals.filter((d) => d.payment?.status === 'paid' && d.payment.paid_date)

  const lockedDeals = deals.filter((d) => isSameMonth(d.created_at.slice(0, 10), now))
  const lockedThisMonth: MoneyBucket = {
    count: lockedDeals.length,
    value: lockedDeals.reduce((sum, d) => sum + d.rate, 0),
  }

  const earnedDeals = paidDeals.filter((d) => isSameMonth(d.payment!.paid_date!, now))
  const earnedThisMonth: MoneyBucket = {
    count: earnedDeals.length,
    value: earnedDeals.reduce((sum, d) => sum + (d.payment?.amount ?? d.rate), 0),
  }

  const pending: MoneyBucket = { count: 0, value: 0 }
  const overdue: MoneyBucket = { count: 0, value: 0 }

  for (const deal of deals) {
    if (!deal.payment || deal.payment.status === 'paid') continue
    const amount = deal.payment.amount ?? deal.rate

    pending.count += 1
    pending.value += amount

    if (getPaymentAlertTone(deal.payment) === 'overdue') {
      overdue.count += 1
      overdue.value += amount
    }
  }

  const averageDealValue =
    deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + d.rate, 0) / deals.length) : 0

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

  return {
    lockedThisMonth,
    earnedThisMonth,
    pending,
    overdue,
    averageDealValue,
    dealsClosed: paidDeals.length,
    bestPayingBrand,
    monthlyTotals,
  }
}
