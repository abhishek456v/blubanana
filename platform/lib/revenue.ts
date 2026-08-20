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

/**
 * The same pair, for a total built from `deals.rate` rather than `payments`.
 *
 * `value` is null when one of the rates in it is withheld from this reader
 * (see `Deal.rate`), because a total missing a figure is worse than no total.
 * The count stays exact: how many deals there were is not a commercial secret,
 * what they were worth is. `formatCurrency` renders null as an em dash.
 *
 * Separate from `MoneyBucket` so the payment-derived figures keep their
 * non-null guarantee — those are gated as whole tables and never arrive
 * partially masked.
 */
export interface MaskableMoneyBucket {
  count: number
  value: number | null
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
  lockedThisMonth: MaskableMoneyBucket
  /** Payments actually received this calendar month. */
  earnedThisMonth: MoneyBucket
  /** Everything billed or expected and not yet received. */
  pending: MoneyBucket
  /** The subset of pending that is already past its due date. */
  overdue: MoneyBucket
  /** Null when any deal's rate is withheld from this reader — see `MoneyBucket`. */
  averageDealValue: number | null
  /**
   * Of everything invoiced, what share actually arrived, and how long it took.
   *
   * No creator tracks this, and it is the number that says which brands to
   * stop working with. Null until there is something settled to measure.
   */
  collection: { rate: number; averageDays: number } | null
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

  // Totals over `rate` are the only ones that can come back withheld; every
  // other figure on Money is derived from `payments`, which is gated as a whole
  // table rather than masked per column.
  const sumRates = (rows: readonly { rate: number | null }[]): number | null => {
    let sum = 0
    for (const row of rows) {
      if (row.rate === null) return null
      sum += row.rate
    }
    return sum
  }

  const lockedDeals = deals.filter((d) => isSameMonth(d.created_at.slice(0, 10), now))
  const lockedThisMonth: MaskableMoneyBucket = {
    count: lockedDeals.length,
    value: sumRates(lockedDeals),
  }

  const earnedRows = settled.filter(({ payment }) => isSameMonth(payment.paid_date!, now))
  const earnedThisMonth: MoneyBucket = {
    count: earnedRows.length,
    value: earnedRows.reduce((sum, row) => sum + landed(row), 0),
  }

  const pending: MoneyBucket = { count: 0, value: 0 }
  const overdue: MoneyBucket = { count: 0, value: 0 }

  /**
   * Deals, not payment rows.
   *
   * `pending.count` is captioned "N unpaid deals" on Home and on Money, and
   * the list under it is a list of deals. It was incremented once per unpaid
   * *payment*, so a deal owed in two instalments was counted twice and the
   * caption disagreed with the rows directly beneath it.
   *
   * `overdue.count` deliberately stays a payment count: it is captioned
   * "N payments late", which is what a creator chasing money wants to know.
   */
  const pendingDeals = new Set<string>()

  for (const { deal, payment } of rows) {
    if (payment.status === 'paid') continue
    // A held deal is not expected income. Counting it keeps "still out"
    // climbing with deals that are never going to pay (§8.6).
    if (deal.on_hold) continue

    pendingDeals.add(deal.id)
    pending.value += payment.amount

    if (getPaymentAlertTone(payment) === 'overdue') {
      overdue.count += 1
      overdue.value += payment.amount
    }
  }

  pending.count = pendingDeals.size

  const dealTotal = sumRates(deals)
  const averageDealValue =
    deals.length > 0 && dealTotal !== null ? Math.round(dealTotal / deals.length) : null

  // Measured against everything billed, settled or not, so a brand sitting on
  // an invoice drags the rate down rather than being quietly excluded.
  const billed = rows.reduce((sum, { payment }) => sum + payment.amount, 0)
  const collectedTotal = settled.reduce((sum, row) => sum + landed(row), 0)

  const daysToPay = settled
    .filter(({ payment }) => payment.due_date && payment.paid_date)
    .map(({ payment }) => {
      const due = new Date(payment.due_date!).getTime()
      const paid = new Date(payment.paid_date!).getTime()
      return Math.round((paid - due) / 86_400_000)
    })

  const collection =
    billed > 0 && settled.length > 0
      ? {
          rate: Math.round((collectedTotal / billed) * 100),
          // Relative to the due date, so 0 means "on time" and a negative
          // number means early. Days-since-invoice would flatter long terms.
          averageDays:
            daysToPay.length > 0
              ? Math.round(daysToPay.reduce((a, b) => a + b, 0) / daysToPay.length)
              : 0,
        }
      : null

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
    collection,
    // Deals, not payments: a deal is closed when everything on it is settled.
    dealsClosed: deals.filter((deal) => isFullyPaid(deal)).length,
    bestPayingBrand,
    monthlyTotals,
  }
}
