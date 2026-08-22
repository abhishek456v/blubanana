// The demo workspace the marketing site is photographed from.
//
//   node scripts/seed-demo.mjs
//
// Why this exists: the website's credibility rests on showing the real product,
// which means real screenshots of a real workspace with a year of business in
// it. The obvious workspace to photograph is the founder's own — and that one
// holds named brands beside their commercial terms. Publishing that implies
// relationships that do not exist and puts a brand's rate on the open internet.
//
// So the site is photographed from here instead: a workspace whose brands are
// invented, whose figures are invented, and whose shape is exactly what a
// working creator's account looks like fourteen months in.
//
// Deterministic. The same seed produces the same amounts every run, so a
// screenshot retaken after a UI change differs only by the UI change. Dates are
// relative to today, because a demo dated last year reads as abandoned.
//
// Writes with the service role, so it bypasses RLS. It therefore sets
// workspace_id explicitly on every row rather than relying on a policy to do it.

import { readFileSync } from 'node:fs'

// ── env ─────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    })
)

const URL_ = env.EXPO_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SERVICE) throw new Error('Missing Supabase URL or service role key in .env')

const EMAIL = process.env.DEMO_EMAIL ?? 'demo@creatordesk.in'
const PASSWORD = process.env.DEMO_PASSWORD ?? 'CreatorDeskDemo!2026'

// Plain fetch rather than supabase-js: the client pulls in realtime, which
// wants a native WebSocket this Node build does not have. Nothing here needs a
// socket, a session or an auth refresh — it is inserts against PostgREST and
// two calls to the admin API.
const H = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}

async function rest(path, init = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, Prefer: 'return=representation', ...(init.headers ?? {}) },
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${path}: ${r.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : []
}

async function admin(path, init = {}) {
  const r = await fetch(`${URL_}/auth/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } })
  const text = await r.text()
  if (!r.ok) throw new Error(`auth ${path}: ${r.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

// ── determinism ─────────────────────────────────────────────────────────────
// mulberry32. One fixed seed, so every run produces the same business.
let state = 0x9e3779b9
function rnd() {
  state |= 0
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (list) => list[Math.floor(rnd() * list.length)]
/** Rounded to the nearest 500, the way a rate is actually quoted. */
const money = (lo, hi) => Math.round((lo + rnd() * (hi - lo)) / 500) * 500

const TODAY = new Date()
const day = (offset) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offset)
  return d
}
const iso = (d) => d.toISOString().slice(0, 10)

// ── the cast ────────────────────────────────────────────────────────────────
// Invented brands. Plausible Indian D2C names, none of them a real company —
// which is the entire point: a screenshot on a public site must not imply a
// client relationship, and must not put anyone's real rate on the internet.
const BRANDS = [
  ['Lumora Skincare',   'Ritika Sharma',  'ritika@lumora.in',      '29AABCL1234M1Z8', '29', 'Bengaluru, Karnataka'],
  ['Tarai Coffee Co.',  'Karan Mehta',    'karan@taraicoffee.in',  '07AAFCT5678K1Z2', '07', 'New Delhi'],
  ['Orbyn Audio',       'Sneha Rao',      'sneha@orbyn.in',        '27AAACO9012L1Z4', '27', 'Mumbai, Maharashtra'],
  ['Saffra Foods',      'Aditya Nair',    'aditya@saffra.in',      '27AADCS3456N1Z9', '27', 'Pune, Maharashtra'],
  ['Rewa Wellness',     'Priya Menon',    'priya@rewawellness.in', '29AAECR7890P1Z3', '29', 'Bengaluru, Karnataka'],
  ['Nixel Tech',        'Rohan Gupta',    'rohan@nixel.in',        '29AAECN2345Q1Z7', '29', 'Bengaluru, Karnataka'],
  ['Vireo Athleisure',  'Ananya Iyer',    'ananya@vireo.in',       '06AAFCV6789R1Z1', '06', 'Gurugram, Haryana'],
  ['Panara Jewellery',  'Vikram Desai',   'vikram@panara.in',      '24AAECP0123S1Z5', '24', 'Ahmedabad, Gujarat'],
  ['Casira Home',       'Neha Bansal',    'neha@casira.in',        '33AABCC4567T1Z6', '33', 'Chennai, Tamil Nadu'],
  ['Kosha Finance',     'Ishaan Kapoor',  'ishaan@kosha.in',       '27AAGCK8901U1Z0', '27', 'Mumbai, Maharashtra'],
]

// What a creator actually sells, with the rate band each one goes for.
const SHAPES = [
  ['instagram_reel',  '1 Reel',                      'reel',           18000,  45000],
  ['instagram_reel',  '1 Reel + 3 Stories',          'reel',           25000,  60000],
  ['instagram_story', '3 Stories',                   'story',           8000,  18000],
  ['instagram_feed',  '1 Feed post + 2 Stories',     'carousel',       15000,  35000],
  ['youtube_long',    'YouTube integration, 60 to 90s', 'yt_integration', 45000, 120000],
  ['youtube_short',   '1 YouTube Short',             'yt_short',       20000,  40000],
]

const EXPENSES = [
  ['Editing',        6000, 18000, ['Reel edit, freelance editor', 'Long-form edit, 12 min', 'Colour grade and sound']],
  ['Camera & gear',  4000, 42000, ['Lens rental for the shoot', 'Wireless mic set', 'Tripod and light stand']],
  ['Team & salaries',8000, 30000, ['Assistant for the shoot day', 'Script writer, two briefs']],
  ['Travel',         1500, 22000, ['Cab to the shoot location', 'Flight for the campaign shoot', 'Hotel, two nights']],
  ['Props & samples',1200, 14000, ['Props for the kitchen set', 'Wardrobe for the campaign']],
  ['Software',        499,  4500, ['Editing subscription', 'Stock music licence', 'Cloud storage']],
]

// ── helpers ─────────────────────────────────────────────────────────────────
async function insert(table, rows) {
  if (!rows.length) return []
  const out = []
  for (let i = 0; i < rows.length; i += 100) {
    out.push(...(await rest(table, { method: 'POST', body: JSON.stringify(rows.slice(i, i + 100)) })))
  }
  return out
}

async function findOrCreateUser() {
  // The listing is paginated; the demo account is one of very few, so one page
  // is enough today — but filtering rather than indexing keeps it correct if not.
  const list = await admin('admin/users?per_page=200')
  const existing = (list.users ?? []).find((u) => u.email === EMAIL)
  if (existing) return existing

  // handle_new_user() builds the workspace, membership, profile and trial on
  // this insert. It is a trigger, not a queue, so it has already run when this
  // call returns.
  return admin('admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Aanya Kulkarni' },
    }),
  })
}

// ── run ─────────────────────────────────────────────────────────────────────
const user = await findOrCreateUser()
console.log(`user      ${EMAIL} (${user.id.slice(0, 8)}…)`)

const memberships = await rest(`memberships?select=workspace_id&user_id=eq.${user.id}&limit=1`)
if (!memberships.length) throw new Error('no workspace for the demo user')
const workspace_id = memberships[0].workspace_id
console.log(`workspace ${workspace_id.slice(0, 8)}…`)

// Internal, so the trial's ten-deal cap does not apply and the workspace never
// falls into the read-only state mid-screenshot. `is_internal` also keeps it
// out of the 500 launch places (035), so a demo account cannot eat the offer.
await rest(`subscriptions?workspace_id=eq.${workspace_id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    is_internal: true,
    status: 'active',
    current_period_end: new Date(TODAY.getFullYear() + 5, 0, 1).toISOString(),
  }),
})

// Teardown, in foreign-key order. `deals.brand_id` is `on delete restrict`, so
// brands cannot go first; everything hanging off a deal cascades with it.
for (const table of ['expenses', 'brand_ratings', 'invoices', 'deals', 'brands']) {
  await rest(`${table}?workspace_id=eq.${workspace_id}`, { method: 'DELETE' })
}
console.log('cleared   previous demo data')

await rest(`profiles?id=eq.${user.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
  name: 'Aanya Kulkarni',
  phone: '+91 98450 12345',
  follower_count: 184000,
  niche: 'Lifestyle & travel',
  address: 'Indiranagar, Bengaluru, Karnataka 560038',
  gstin: '29ABCDE1234F1Z5',
  upi_id: 'aanya@okhdfcbank',
  bank_account_number: '50100234567890',
  ifsc_code: 'HDFC0001234',
    card_theme: 'horizon',
  }),
})

const brands = await insert(
  'brands',
  BRANDS.map(([name, , , gstin, state_code, address]) => ({ workspace_id, name, gstin, state_code, address }))
)
await insert(
  'brand_contacts',
  brands.map((brand, i) => ({
    workspace_id,
    brand_id: brand.id,
    name: BRANDS[i][1],
    email: BRANDS[i][2],
    phone: `+91 9${String(80000000 + i * 111111).slice(0, 9)}`,
    role: pick(['Marketing Manager', 'Brand Partnerships', 'Influencer Marketing Lead']),
    is_primary: true,
  }))
)
console.log(`brands    ${brands.length}`)

// ── the deals ───────────────────────────────────────────────────────────────
// Fourteen months back to six weeks ahead. The past gives the revenue chart a
// shape and the year-in-review something to report; the future is what makes
// Home look like a working week rather than an archive.
const deals = []
for (let i = 0; i < 34; i++) {
  const brand = brands[Math.floor(rnd() * brands.length)]
  const [platform, description, kind, lo, hi] = pick(SHAPES)
  const offset = Math.round(-420 + rnd() * 462)
  const rate = money(lo, hi)

  const status =
    offset < -60 ? 'paid'
    : offset < -20 ? (rnd() < 0.75 ? 'paid' : 'unpaid')
    : offset < 0 ? (rnd() < 0.5 ? 'unpaid' : 'live')
    : 'active'

  deals.push({
    row: {
      workspace_id,
      brand_id: brand.id,
      platform,
      deliverable_description: description,
      rate,
      status,
      // Two deals that went quiet. Every creator has them, and a demo without
      // any is a demo of a business that never loses one.
      on_hold: i === 7 || i === 19,
      on_hold_at: i === 7 || i === 19 ? day(offset - 5).toISOString() : null,
      currency: 'INR',
      creator_follower_count_at_time: 184000,
      ad_rights_granted: rnd() < 0.22,
      created_at: day(offset - 20).toISOString(),
      live_link: offset < 0 ? `https://www.instagram.com/reel/demo${i}` : null,
      // Present on every row even when unused: PostgREST rejects a bulk insert
      // whose objects do not all carry the same keys, so an ad-rights column
      // that appears on some rows and not others fails the whole batch.
      ad_rights_fee: null,
      ad_rights_duration_months: null,
      ad_rights_start_date: null,
      ad_rights_expires_date: null,
    },
    offset,
    kind,
    platform,
    rate,
  })
}

// Ad rights need their terms, and an expiry derived from start + duration
// rather than typed twice (§8.14, and the off-by-one 026 corrected).
for (const deal of deals) {
  if (!deal.row.ad_rights_granted) continue
  const months = pick([3, 6, 12])
  const start = day(deal.offset)
  const expires = new Date(start)
  expires.setMonth(expires.getMonth() + months)
  deal.row.ad_rights_fee = Math.round(deal.rate * 0.3 / 500) * 500
  deal.row.ad_rights_duration_months = months
  deal.row.ad_rights_start_date = iso(start)
  deal.row.ad_rights_expires_date = iso(expires)
}

const written = await insert('deals', deals.map((d) => d.row))
written.forEach((row, i) => (deals[i].id = row.id))
console.log(`deals     ${written.length}`)

// ── stages, deliverables, payments ──────────────────────────────────────────
const stages = []
const deliverables = []
const payments = []

for (const deal of deals) {
  const publish = deal.offset
  // The four defaults, dated backwards from publish. A stage in the past on a
  // deal that has published is done; one in the future is not.
  const plan = [
    ['Script', publish - 14],
    ['Shoot', publish - 9],
    ['Edit', publish - 3],
    ['Publish', publish],
  ]
  plan.forEach(([name, offset], sort_order) => {
    const done = offset < 0 && !deal.row.on_hold
    stages.push({
      workspace_id,
      deal_id: deal.id,
      name,
      sort_order,
      due_date: iso(day(offset)),
      done,
      done_at: done ? day(offset).toISOString() : null,
    })
  })

  deliverables.push({
    workspace_id,
    deal_id: deal.id,
    kind: deal.kind,
    platform: deal.platform,
    quantity: 1,
    description: deal.row.deliverable_description,
    rate: deal.rate,
    due_date: iso(day(publish)),
    published_at: publish < 0 ? iso(day(publish)) : null,
    sort_order: 0,
  })

  // Half the deals are 50/50 advance and balance, which is the most common
  // arrangement in Indian creator work and the reason 021 dropped the unique
  // constraint on payments.deal_id.
  const split = rnd() < 0.5
  const terms = pick(['30 days from publish', '45 days from publish', 'On delivery'])
  const dueOffset = terms === 'On delivery' ? publish + 3 : publish + (terms.startsWith('30') ? 30 : 45)

  const settle = (amount, dueAt, label, sort_order) => {
    const paid = deal.row.status === 'paid' || (label === 'Advance' && publish < -5)
    const overdue = !paid && dueAt < 0
    // TDS at 10% under s.194J on roughly half of what gets paid: some brands
    // deduct, some do not, and a demo where every payment is clean would hide
    // the one dialog this product exists to get right.
    const tds = paid && rnd() < 0.55 ? Math.round(amount * 0.1) : 0
    return {
      workspace_id,
      deal_id: deal.id,
      amount,
      label,
      sort_order,
      payment_terms: terms,
      due_date: iso(day(dueAt)),
      status: paid ? 'paid' : overdue ? 'overdue' : rnd() < 0.3 ? 'reminder_sent' : 'pending',
      paid_date: paid ? iso(day(dueAt - Math.round(rnd() * 6))) : null,
      amount_received: paid ? amount - tds : null,
      tds_amount: tds,
    }
  }

  if (split) {
    const advance = Math.round(deal.rate / 2 / 500) * 500
    payments.push(settle(advance, publish - 10, 'Advance', 0))
    payments.push(settle(deal.rate - advance, dueOffset, 'Balance', 1))
  } else {
    payments.push(settle(deal.rate, dueOffset, null, 0))
  }
}

await insert('deal_stages', stages)
await insert('deal_deliverables', deliverables)
await insert('payments', payments)
console.log(`stages    ${stages.length}\npayments  ${payments.length}`)

// ── expenses and ratings ────────────────────────────────────────────────────
const expenses = []
for (let i = 0; i < 26; i++) {
  const [category, lo, hi, notes] = pick(EXPENSES)
  expenses.push({
    workspace_id,
    spent_on: iso(day(Math.round(-400 + rnd() * 400))),
    amount: money(lo, hi),
    category,
    note: pick(notes),
  })
}
await insert('expenses', expenses)

const rated = deals.filter((d) => d.row.status === 'paid').slice(0, 9)
await insert(
  'brand_ratings',
  rated.map((deal) => {
    const onTime = rnd() < 0.7
    return {
      workspace_id,
      brand_id: deal.row.brand_id,
      deal_id: deal.id,
      rating: onTime ? pick([4, 5, 5]) : pick([2, 3]),
      paid_on_time: onTime,
      easy_to_work_with: rnd() < 0.8,
      revision_rounds: pick([1, 1, 2, 3]),
      would_work_again: onTime || rnd() < 0.5,
    }
  })
)
console.log(`expenses  ${expenses.length}\nratings   ${rated.length}`)

// ── invoices ────────────────────────────────────────────────────────────────
// Three, because the printed invoice is the one artefact a brand's finance
// team ever sees and the site shows it full size. One intra-State (CGST+SGST),
// one inter-State (IGST) and one already settled with TDS withheld — which is
// the whole of Indian creator invoicing in three documents.
const CREATOR_STATE = '29'
const invoiceable = deals
  .filter((d) => ['unpaid', 'live', 'paid'].includes(d.row.status))
  .slice(0, 3)

const invoices = []
invoiceable.forEach((deal, i) => {
  const brand = brands.find((b) => b.id === deal.row.brand_id)
  const source = BRANDS.find(([name]) => name === brand.name)
  const state = source[4]
  const amount = deal.rate
  const gst = Math.round(amount * 0.18)
  const interState = state !== CREATOR_STATE
  const tds = i === 2 ? Math.round(amount * 0.1) : 0

  invoices.push({
    workspace_id,
    deal_id: deal.id,
    invoice_number: `INV-${String(i + 1).padStart(3, '0')}`,
    invoice_date: iso(day(deal.offset + 2)),
    brand_name: brand.name,
    brand_contact_person: source[1],
    brand_contact_email: source[2],
    brand_gstin: source[3],
    brand_address: source[5],
    place_of_supply_code: state,
    supplier_address: 'Indiranagar, Bengaluru, Karnataka 560038',
    description: deal.row.deliverable_description,
    amount,
    gst_applicable: true,
    gst_rate: 18,
    gst_amount: gst,
    cgst_amount: interState ? 0 : Math.round(gst / 2),
    sgst_amount: interState ? 0 : gst - Math.round(gst / 2),
    igst_amount: interState ? gst : 0,
    total_amount: amount + gst,
    payment_due_date: iso(day(deal.offset + 32)),
    tds_deducted: tds > 0,
    tds_amount: tds,
    reverse_charge: false,
    notes: null,
  })
})

const writtenInvoices = await insert('invoices', invoices)
await insert(
  'invoice_line_items',
  writtenInvoices.map((invoice, i) => ({
    workspace_id,
    invoice_id: invoice.id,
    deal_id: invoiceable[i].id,
    description: invoiceable[i].row.deliverable_description,
    // 998397 — "sponsorship services". The default the app uses.
    hsn_sac: '998397',
    quantity: 1,
    unit_amount: invoiceable[i].rate,
    amount: invoiceable[i].rate,
    sort_order: 0,
  }))
)
console.log(`invoices  ${writtenInvoices.length}`)
console.log(`  preview: /invoice/${writtenInvoices[0]?.id ?? ''}`)

console.log(`\nSigned in as ${EMAIL} / ${PASSWORD}`)
