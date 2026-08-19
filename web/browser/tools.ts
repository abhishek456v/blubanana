// The browser bundle behind the free tools.
//
// It re-exports the app's own modules rather than reimplementing them. That is
// the entire point of these pages: the advance tax split on the website and the
// advance tax split inside CreatorDesk are the same function, so a change to the
// statute is one edit and both move together. A second copy would be wrong
// eventually, and wrong in a way nobody would notice until someone filed on it.
//
// Both modules are pure arithmetic with no imports of their own, which is why
// they can cross into a browser bundle untouched.

export { ADVANCE_TAX_INSTALMENTS, advanceTaxSchedule, financialYearStart, estimateTax } from '../../lib/tax'
export { GST_STATE_OPTIONS, splitGst, stateName } from '../../constants/gst'

/** Indian digit grouping. The rest of the site formats money the same way. */
export function inr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

/**
 * TDS on a creator's invoice.
 *
 * Deducted on the value of the service, never on the GST charged on top of it,
 * which is the mistake that makes a creator's arithmetic disagree with the
 * brand's remittance advice by exactly the tax on the tax.
 */
export function tds(base: number, ratePercent: number, gstPercent: number) {
  const gst = Math.round((base * gstPercent) / 100)
  const withheld = Math.round((base * ratePercent) / 100)
  return { gst, invoiceTotal: base + gst, withheld, received: base + gst - withheld }
}

/**
 * Engagement rate.
 *
 * Two denominators, because brands ask for both and mean different things. On
 * followers it is the number quoted in a media kit; on reach it is the number
 * that describes how a specific post performed.
 */
export function engagement(likes: number, comments: number, saves: number, denominator: number) {
  if (!denominator) return 0
  return ((likes + comments + saves) / denominator) * 100
}

/**
 * A rate range from what a post actually reaches.
 *
 * This is arithmetic on the creator's own numbers, not a market benchmark: cost
 * per thousand views is the unit brands buy in, and the band is the one she
 * sets. A page that invented a going rate would be guessing with someone's
 * livelihood, and it would be wrong differently in every category.
 */
export function rateFromReach(views: number, cpmLow: number, cpmHigh: number) {
  return { low: Math.round((views / 1000) * cpmLow), high: Math.round((views / 1000) * cpmHigh) }
}
