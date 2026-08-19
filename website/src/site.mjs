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
  entity: 'Blubanana',
  legalName: 'TODO: the registered legal entity name',
  address: 'TODO: registered address, city, state, PIN',
  phone: 'TODO: a number that is answered',
  email: 'hello@blubanana.in',
  support: 'support@blubanana.in',
  gstin: null,
  hours: 'Monday to Friday, 10am to 7pm IST',
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
  // Environment variables first, then the file.
  //
  // On this machine the values live in platform/.env, where Expo requires
  // them. On a build server that file does not exist and the values are set in
  // the project's settings instead, so both have to be tried or the hosted
  // build silently loses the live price and the launch counter.
  const fromEnv = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? null,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null,
  }
  if (fromEnv.url && fromEnv.anonKey) return fromEnv

  try {
    const env = readFileSync(new URL('../../platform/.env', import.meta.url), 'utf8')
    const read = (key) => env.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim() ?? null
    return { url: read('EXPO_PUBLIC_SUPABASE_URL'), anonKey: read('EXPO_PUBLIC_SUPABASE_ANON_KEY') }
  } catch {
    // Neither. The site still builds; the prices are the ones compiled into it
    // rather than the ones in the database.
    return { url: null, anonKey: null }
  }
})()

export const SITE = {
  name: 'Blubanana',
  /** The logo sets it in lower case, with "blu" carrying the accent. */
  wordmark: ['blu', 'banana'],
  domain: 'blubanana.in',
  origin: 'https://blubanana.in',
  platform: 'https://platform.blubanana.in',
  signup: 'https://platform.blubanana.in/sign-up',
  login: 'https://platform.blubanana.in/sign-in',
  /** For someone who has already decided. Skips the trial and goes to checkout. */
  subscribe: 'https://platform.blubanana.in/plans',
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

/** The free tools. Each is a real calculator, and each is a page. */
export const TOOLS = [
  ['/tools/advance-tax-calculator', 'Advance tax calculator', 'What to set aside, and by which of the four dates'],
  ['/tools/tds-calculator', 'TDS calculator', 'They deducted 10%. What actually reaches your bank'],
  ['/tools/gst-calculator', 'GST calculator', 'CGST and SGST, or IGST, worked out from the two states'],
  ['/tools/rate-calculator', 'Rate calculator', 'What your reach is worth, per format'],
  ['/tools/engagement-rate-calculator', 'Engagement rate calculator', 'The number every brand asks for first'],
]

/**
 * The navigation.
 *
 * `items: 'product'` is filled in by the layout from the product pages
 * themselves, so a new feature page appears in the menu and the footer by
 * existing rather than by being remembered. The build fails on any internal
 * link with no page behind it, so this cannot quietly rot either.
 */
export const NAV = [
  { label: 'Features', href: '/features', items: 'product' },
  { label: 'Free tools', href: '/tools', items: TOOLS.map(([href, title, note]) => [href, title, note]) },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Compare', href: '/compare' },
  { label: 'Contact', href: '/contact' },
]

export const FOOTER = [
  { title: 'Features', links: 'product' },
  { title: 'Free tools', links: TOOLS.map(([href, title]) => [href, title.replace(' calculator', '')]) },
  {
    title: 'Company',
    links: [
      ['/security', 'Security'],
      ['/pricing', 'Pricing'],
      ['/compare', 'Compare'],
      ['/contact', 'Contact'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['/terms', 'Terms'],
      ['/privacy', 'Privacy'],
      ['/refunds', 'Cancellation and refunds'],
    ],
  },
]
