/**
 * Advance tax instalments for an individual (section 211 of the Income-tax
 * Act).
 *
 * These four percentages are fixed in statute and have not moved in years,
 * which is why they are safe to hardcode. Slab rates are not: they change most
 * budgets, and a stale slab table silently produces a wrong number that looks
 * authoritative. So this module never guesses a rate — the creator supplies
 * the tax she expects to owe, and this splits it across the dates.
 */
export const ADVANCE_TAX_INSTALMENTS = [
  { label: '15 June', month: 5, day: 15, cumulative: 0.15 },
  { label: '15 September', month: 8, day: 15, cumulative: 0.45 },
  { label: '15 December', month: 11, day: 15, cumulative: 0.75 },
  { label: '15 March', month: 2, day: 15, cumulative: 1.0 },
] as const

export interface Instalment {
  label: string
  /** Total payable by this date, per section 211. */
  cumulative: number
  /** What is due at this instalment alone, given what came before. */
  thisInstalment: number
  dueOn: Date
  isPast: boolean
}

/**
 * Splits an expected annual tax across the four statutory dates.
 *
 * Dates fall in the financial year beginning `fyStartYear`: June, September
 * and December of that year, then March of the next.
 */
export function advanceTaxSchedule(
  expectedTax: number,
  fyStartYear: number,
  today: Date = new Date()
): Instalment[] {
  let paidSoFar = 0

  return ADVANCE_TAX_INSTALMENTS.map((instalment) => {
    const year = instalment.month === 2 ? fyStartYear + 1 : fyStartYear
    const dueOn = new Date(year, instalment.month, instalment.day)

    const cumulative = Math.round(expectedTax * instalment.cumulative)
    const thisInstalment = Math.max(cumulative - paidSoFar, 0)
    paidSoFar = cumulative

    return {
      label: instalment.label,
      cumulative,
      thisInstalment,
      dueOn,
      isPast: dueOn.getTime() < today.getTime(),
    }
  })
}

/** The Indian financial year containing `date`, as its starting calendar year. */
export function financialYearStart(date: Date = new Date()): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

/**
 * A rough tax figure from a rate the creator picks.
 *
 * Deliberately not a slab calculation. The app only sees the income that
 * passed through it — she may have salary, interest, or another business it
 * never saw — so any figure it computed from slabs alone would be wrong in a
 * way that looks precise. Taking her own effective rate keeps the arithmetic
 * honest about whose number it is.
 */
export function estimateTax(netIncome: number, ratePercent: number): number {
  return Math.max(Math.round((netIncome * ratePercent) / 100), 0)
}
