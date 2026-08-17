import { isFullyPaid, paymentsInOrder, type DealWithPaymentSummary } from './deals'
import { getPaymentAlertTone } from './paymentReminders'

// Revenue dashboard. Every number here is derived client-side from deals +
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
   * it *now*: earnings only show up 45 to 90 days after the work, so a
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

  // Money is counted per PAYMENT, not per deal (migration 021). A deal on
  // "50% advance, 50% on delivery" has revenue the moment the advance lands,
  // and counting it per deal would either ignore that or count the whole deal
  // as earned. Both are wrong, and the second is wrong in the direction that
  // makes a creator think she has been paid.
  const rows = deals.flatMap((deal) =>
    paymentsInOrder(deal).map((payment) => ({ deal, payment }))
  )

  const settled = rows.filter(({ payment }) => payment.status === 'paid' && payment.paid_date)

  // What actually landed, where it was recorded. A brand that withholds TDS
  // pays less than it was invoiced, and the received figure is the one that
  // reconciles against a bank statement.
  const landed = ({ payment }: (typeof rows)[number]) => payment.amount_received ?? payment.amount

  const lockedDeals = deals.filter((d) => isSameMonth(d.created_at.slice(0, 10), now))
  const lockedThisMonth: MoneyBucket = {
    count: lockedDeals.length,
    value: lockedDeals.reduce((sum, d) => sum + d.rate, 0),
  }

  const earnedRows = settled.filter(({ payment }) => isSameMonth(payment.paid_date!, now))
  const earnedThisMonth: MoneyBucket = {
    count: earnedRows.length,
    value: earnedRows.reduce((sum, row) => sum + landed(row), 0),
  }

  const pending: MoneyBucket = { count: 0, value: 0 }
  const overdue: MoneyBucket = { count: 0, value: 0 }

  for (const { deal, payment } of rows) {
    if (payment.status === 'paid') continue
    // A held deal is not expected income. Counting it keeps "still out"
    // climbing with deals that are never going to pay (§8.6).
    if (deal.on_hold) continue

    pending.count += 1
    pending.value += payment.amount

    if (getPaymentAlertTone(payment) === 'overdue') {
      overdue.count += 1
      overdue.value += payment.amount
    }
  }

  const averageDealValue =
    deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + d.rate, 0) / deals.length) : 0

  const byBrand = new Map<string, number>()
  for (const row of settled) {
    const name = row.deal.brand?.name ?? 'Unknown brand'
    byBrand.set(name, (byBrand.get(name) ?? 0) + landed(row))
  }
  let bestPayingBrand: RevenueSummary['bestPayingBrand'] = null
  for (const [name, total] of byBrand) {
    if (!bestPayingBrand || total > bestPayingBrand.total) bestPayingBrand = { name, total }
  }

  const monthlyTotals: RevenueSummary['monthlyTotals'] = []
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const total = settled
      .filter(({ payment }) => isSameMonth(payment.paid_date!, ref))
      .reduce((sum, row) => sum + landed(row), 0)
    monthlyTotals.push({ label: ref.toLocaleDateString('en-IN', { month: 'short' }), total })
  }

  return {
    lockedThisMonth,
    earnedThisMonth,
    pending,
    overdue,
    averageDealValue,
    // Deals, not payments: a deal is closed when everything on it is settled.
    dealsClosed: deals.filter((deal) => isFullyPaid(deal)).length,
    bestPayingBrand,
    monthlyTotals,
  }
}
