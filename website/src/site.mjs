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
const COMPANY_IN_CODE = {
  entity: 'Blubanana',
  legalName: 'Blubanana Marketing',
  address: 'WeWork, HSR Layout, Bengaluru 560102',
  phone: '+91 78000 39987',
  email: 'hello@blubanana.in',
  support: 'hello@blubanana.in',
  gstin: null,
  hours: 'Monday to Friday, 10am to 7pm IST',
  /** Digits only, for the wa.me link. Same number as the phone line. */
  whatsapp: '917800039987',
}

/**
 * Read from the environment, then from the file.
 *
 * Public by definition: the anon key is compiled into the app's own bundle and
 * is the key row-level security is designed around. It reaches exactly two
 * things here, the pricing row and the launch seat count, both granted to
 * `anon` by migration 035 for this purpose.
 *
 * On this machine the values live in platform/.env, where Expo requires them.
 * On a build server that file does not exist and they are set in the project's
 * settings instead, so both have to be tried or the hosted build silently loses
 * the live price and the counter.
 */
export const SUPABASE = (() => {
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
 * Google Analytics 4.
 *
 * The Measurement ID sits here in the file rather than in an environment
 * variable, because it is public by definition: it identifies the property and
 * Google's own install instructions put it in the page source. Hiding it in a
 * dashboard would only mean a local build and a deployed one behave
 * differently, which is how a tracking bug survives a fortnight.
 *
 * Empty is a supported value and means no analytics at all: no script, no
 * banner, no cookies.
 *
 * Preview deployments get nothing. Every branch push would otherwise land in
 * the same property as real visitors, and the first week of data would be
 * mostly me.
 *
 * GA sets cookies, which under the DPDP Act 2023 needs consent taken *before*
 * they are set. Hence the gate in `layout.mjs`: nothing loads until someone
 * accepts, and declining is remembered too, so the banner is asked once
 * rather than on every page.
 */
export const ANALYTICS = {
  measurementId:
    process.env.VERCEL_ENV === 'preview'
      ? ''
      : (process.env.GA_MEASUREMENT_ID ?? 'G-ZN5MHYGQ8S'),
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
  { label: 'Writing', href: '/blog' },
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
      ['/blog', 'Writing'],
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


/**
 * The contact details, with anything edited in the dashboard laid over them.
 *
 * ── Why this is fetched here rather than through copy.mjs ───────────────────
 *
 * `copy.mjs` imports this file for the credentials, so having this file import
 * that one would be a cycle with a top level await inside it. This does its own
 * request instead, which is a few more lines and no cleverness.
 *
 * ── Why every field falls back ──────────────────────────────────────────────
 *
 * These strings are on the terms, the privacy policy, the refund terms and the
 * contact page. A blank address on a legal page is worse than an out of date
 * one, and a build that cannot reach the database must still produce a
 * complete, correct site.
 *
 * `whatsapp` is deliberately not stored. It is the phone number with everything
 * but the digits removed, so the two cannot drift apart, which is the obvious
 * way this goes wrong: somebody updates the phone number and the WhatsApp link
 * quietly keeps ringing the old one.
 */
async function contactOverrides() {
  if (!SUPABASE.url || !SUPABASE.anonKey) return {}

  try {
    const response = await fetch(
      `${SUPABASE.url}/rest/v1/site_content?select=key,value&key=like.company.*`,
      {
        headers: { apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}` },
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!response.ok) throw new Error(String(response.status))

    const out = {}
    for (const row of await response.json()) {
      const field = row.key.replace(/^company\./, '')
      if (typeof row.value === 'string' && row.value.trim()) out[field] = row.value.trim()
    }
    return out
  } catch (error) {
    console.warn(`  contact: could not read (${error.message}), using what is in the code`)
    return {}
  }
}

const contact = await contactOverrides()

export const COMPANY = {
  ...COMPANY_IN_CODE,
  ...contact,
  whatsapp: (contact.phone ?? COMPANY_IN_CODE.phone).replace(/\D/g, ''),
}
