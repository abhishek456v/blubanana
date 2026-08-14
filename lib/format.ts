// Shared display formatting.
//
// `₹${n.toLocaleString('en-IN')}` and the YYYY-MM-DD date parser were each
// written independently in lib/whatsapp.ts, lib/invoiceHtml.ts and
// components/DealRow.tsx. They live here now so a rupee reads the same on
// every surface, including the ones rendered to PDF.

/**
 * Parses a `YYYY-MM-DD` string as a *local* date.
 *
 * `new Date('2026-08-14')` parses as UTC midnight, which in IST renders as
 * the 14th but in any negative-offset timezone renders as the 13th. Every
 * date column in this schema is a calendar date with no time component, so
 * local construction is the only correct reading.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Today at local midnight — the baseline for every day-difference below. */
export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Whole days from today to `dateStr`. Negative means the date has passed. */
export function daysFromToday(dateStr: string): number {
  const MS_PER_DAY = 86_400_000
  return Math.round((parseLocalDate(dateStr).getTime() - startOfToday().getTime()) / MS_PER_DAY)
}

/** `₹12,000` — Indian digit grouping (1,00,000 rather than 100,000). */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

/**
 * `₹12.5K` / `₹4.2L` / `₹1.1Cr` — for stat tiles and chart axes where the
 * full figure would wrap. Uses lakh/crore rather than M/B because that is how
 * the number is spoken by the people using this app.
 */
export function formatCurrencyCompact(amount: number | null | undefined): string {
  if (amount == null) return '—'
  const n = Math.round(amount)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''

  if (abs >= 10_000_000) return `${sign}₹${trimZero(abs / 10_000_000)}Cr`
  if (abs >= 100_000) return `${sign}₹${trimZero(abs / 100_000)}L`
  if (abs >= 1_000) return `${sign}₹${trimZero(abs / 1_000)}K`
  return `${sign}₹${abs}`
}

/** One decimal place, but `12` rather than `12.0`. */
function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

/** `12 Sep` */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return parseLocalDate(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** `12 Sep 2026` — for invoices and anything spanning a year boundary. */
export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return parseLocalDate(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Deadline phrasing: `Today`, `Tomorrow`, `In 3 days`, `4 days ago`.
 *
 * Falls back to an absolute date beyond a week in either direction — past
 * that, "in 23 days" is harder to act on than "6 Sep", and the creator is
 * checking a calendar at that point anyway.
 */
export function formatRelativeDay(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const days = daysFromToday(dateStr)

  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 1 && days <= 7) return `In ${days} days`
  if (days < -1 && days >= -7) return `${Math.abs(days)} days ago`
  return formatDate(dateStr)
}

/** Indian financial year (April–March) containing `date`, as `2026-27`. */
export function financialYearOf(date: Date = new Date()): string {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`
}

/** `2026-08-14` — the storage format, from a Date. */
export function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
