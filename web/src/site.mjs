import { readFileSync } from 'node:fs'

// Everything the site knows about itself.
//
// One file so a fact appears once: the phone number in the footer, the phone
// number on the contact page and the phone number in the structured data are
// the same string, and changing it is one edit rather than a search.

/**
 * The details Razorpay's activation review actually checks.
 *
 * Every one of these is still a placeholder, and the site refuses to build with
 * them in place unless `--draft` is passed — see build.mjs. That is deliberate:
 * a marketing site with a fake phone number is not a smaller problem than a
 * missing page, it is the specific thing that fails a merchant activation.
 */
export const COMPANY = {
  entity: 'CreatorDesk',
  legalName: 'TODO — the registered legal entity name',
  address: 'TODO — registered address, city, state, PIN',
  phone: 'TODO — a number that is answered',
  email: 'hello@creatordesk.in',
  support: 'support@creatordesk.in',
  gstin: null,
  hours: 'Monday to Friday, 10am – 7pm IST',
  /** Digits only, for the wa.me link. */
  whatsapp: 'TODO',
}

/**
 * Read from .env at build time and written into the page.
 *
 * Public by definition: the anon key is compiled into the app's own bundle and
 * is the key row-level security is designed around. It reaches exactly two
 * things here — the pricing row and the launch-seat count — both granted to
 * `anon` by migration 035 for this purpose.
 */
export const SUPABASE = (() => {
  try {
    const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8')
    const read = (key) => env.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim() ?? null
    return { url: read('EXPO_PUBLIC_SUPABASE_URL'), anonKey: read('EXPO_PUBLIC_SUPABASE_ANON_KEY') }
  } catch {
    // No .env (a clean checkout, or CI). The site still builds; the prices are
    // simply the ones below rather than the ones in the database.
    return { url: null, anonKey: null }
  }
})()

export const SITE = {
  name: 'CreatorDesk',
  domain: 'creatordesk.in',
  origin: 'https://creatordesk.in',
  platform: 'https://platform.creatordesk.in',
  signup: 'https://platform.creatordesk.in/sign-up',
  login: 'https://platform.creatordesk.in/sign-in',
  tagline: 'The business side of being a creator',
}

/**
 * Pricing, mirrored from the `pricing` table (migration 035).
 *
 * These are the fallback. The live figures are read at runtime with the anon
 * key — 035 grants `select` on `pricing` and `billing_terms` and `execute` on
 * `intro_seats_taken()` to `anon` precisely so a public page can — and the
 * markup is replaced when they arrive. Fallbacks rather than blanks, because a
 * pricing page that renders empty on a slow network is worse than one that is
 * briefly a day out of date.
 */
export const PRICING = {
  listMonthly: 1999,
  introPercent: 50,
  introMonthly: 999,
  yearlyDiscount: 20,
  introSeats: 500,
  gstPercent: 18,
  trialDays: 14,
  trialDeals: 10,
  seats: 5,
  terms: [
    { key: 'monthly', label: 'Monthly', months: 1, list: 1999, intro: 999, perMonth: 999 },
    { key: 'quarterly', label: '3 months', months: 3, list: 5997, intro: 2997, perMonth: 999 },
    { key: 'half_yearly', label: '6 months', months: 6, list: 11994, intro: 5994, perMonth: 999 },
    { key: 'nine_month', label: '9 months', months: 9, list: 17991, intro: 8991, perMonth: 999 },
    { key: 'yearly', label: '12 months', months: 12, list: 19190, intro: 9590, perMonth: 799 },
  ],
}

/** Indian digit grouping. ₹1,00,000 — never ₹100,000. */
export const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/**
 * The navigation.
 *
 * Product currently points at sections of the homepage. Those become real
 * pages in the next phase, at which point only the hrefs here change — which
 * is the reason the menu is data rather than markup. The build fails on any
 * internal link with no page behind it, so this cannot quietly rot.
 */
export const NAV = [
  {
    label: 'Product',
    items: [
      ['/#capture', 'Log a deal in 30 seconds', 'Screenshot, voice note, or type'],
      ['/#deadlines', 'Deadlines that reach you', 'Sent from a server, not your phone'],
      ['/#money', 'Payments and chasing', 'Advances, TDS, and the follow-up written for you'],
      ['/#invoices', 'GST invoices', 'Rule 46, place of supply, UPI QR'],
      ['/#tax', 'Tax and year-end', 'Advance tax, expenses, April to March'],
      ['/#ratecard', 'Your rate card', 'Built from what you have actually charged'],
    ],
  },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
]

export const FOOTER = [
  {
    title: 'Product',
    links: [
      ['/#capture', 'Logging deals'],
      ['/#deadlines', 'Deadlines'],
      ['/#money', 'Payments'],
      ['/#invoices', 'GST invoices'],
      ['/#tax', 'Tax'],
      ['/#ratecard', 'Rate card'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['/pricing', 'Pricing'],
      ['/contact', 'Contact'],
      ['/#faq', 'Questions'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['/terms', 'Terms of service'],
      ['/privacy', 'Privacy policy'],
      ['/refunds', 'Cancellation & refunds'],
    ],
  },
  {
    title: 'Get started',
    links: [
      [SITE.signup, 'Start free'],
      [SITE.login, 'Log in'],
    ],
  },
]
