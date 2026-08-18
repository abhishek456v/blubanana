// The pricing page.
//
// One plan, so this page's job is not to help anyone choose a tier — it is to
// answer, in order: what does it cost, what do I get, what happens when I stop
// paying, and what happens to the price later. A pricing page that leaves the
// fourth question unanswered is the one people write in about.

import { COMPANY, PRICING, SITE, inr } from '../site.mjs'
import { closingCta, faq, faqSchema, head, section } from '../ui.mjs'

const QUESTIONS = [
  [
    'Is the ₹1,999 a real price?',
    `Yes, and that is the reason the launch offer is capped. ${PRICING.introSeats} creators pay ${inr(PRICING.introMonthly)}; after those places are taken, everyone pays ${inr(PRICING.listMonthly)}. A “discount” from a price nobody is ever charged is a fabricated reference price, and we are not going to open with one.`,
  ],
  [
    'What happens to my price at renewal?',
    'The price you start on holds for the entire term you bought. A yearly subscriber keeps their price for twelve months. At renewal, whatever the price is then applies — and if the amount changes, your bank will ask you to approve the new mandate. Nobody gets silently charged more.',
  ],
  [
    'Why are 3, 6 and 9 months not cheaper per month?',
    'Because they are not a discount ladder. They exist for the creator who would rather not think about it again for a while. Only the twelve-month term is discounted, at 20%.',
  ],
  [
    'Do I need a card to start?',
    `No. The ${PRICING.trialDays}-day trial takes an email address. You can create ${PRICING.trialDeals} deals in that time, and everything else is unlimited — reaching ${PRICING.trialDeals} does not end the trial early.`,
  ],
  [
    'What if I stop paying?',
    'Your workspace becomes read-only. Everything stays visible and exportable, for as long as the account exists. We do not lock you out of your own records because a plan lapsed — and deadline and payment reminders keep arriving for another 30 days.',
  ],
  [
    'Is GST included in these prices?',
    `No. Every figure here is exclusive of GST at ${PRICING.gstPercent}%, which is added at checkout. You get a proper tax invoice, carrying your GSTIN if you have given us one.`,
  ],
  [
    'Can I get a refund?',
    'Within 30 days of a payment, yes — in full, and we will not ask how much you used it. After that the term has been provided and is not refunded. The full terms are on the refunds page.',
  ],
  [
    'How many people can use one workspace?',
    `Up to ${PRICING.seats}, included. You choose what each of them can see, area by area — and no invited manager can delete anything, ever.`,
  ],
]

const INCLUDED = [
  ['Unlimited deals, brands, contacts and invoices', 'No caps once you are paying. The trial’s ten-deal limit is the only one that exists.'],
  ['Deadline and payment reminders', 'Sent from a server, so they arrive whether or not you have opened the app this week.'],
  ['Screenshot, voice and spreadsheet capture', 'Including the importer that brings your existing deals across on day one.'],
  ['GST invoicing to Rule 46, with a UPI QR', 'CGST and SGST or IGST from the place of supply. Non-GST invoices if you are not registered.'],
  ['TDS, expenses and the advance-tax calculator', 'Plus an April-to-March report you can hand to a CA.'],
  ['Your rate card, and rate benchmarking', 'Built from what you have actually charged, with the sample size stated.'],
  [`Up to ${PRICING.seats} people in your workspace`, 'With seven separate permission switches, enforced in the database.'],
  ['Export everything, at any time', 'CSV and JSON, including while your account is read-only.'],
]

const table = `<div class="table-wrap reveal" style="margin-top:40px">
  <table>
    <thead>
      <tr><th>Term</th><th class="num-cell" data-intro-only>List price</th><th class="num-cell">You pay</th><th class="num-cell">Per month</th><th class="num-cell">With ${PRICING.gstPercent}% GST</th></tr>
    </thead>
    <tbody>
      ${PRICING.terms
        .map(
          (term) => `<tr>
        <td><strong>${term.label}</strong>${term.key === 'yearly' ? ' <span style="color:var(--success)">· 20% off</span>' : ''}</td>
        <td class="num-cell strike" data-intro-only>${inr(term.list)}</td>
        <td class="num-cell"><strong>${inr(term.intro)}</strong></td>
        <td class="num-cell">${inr(term.perMonth)}</td>
        <td class="num-cell">${inr(Math.round(term.intro * (1 + PRICING.gstPercent / 100)))}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>
</div>`

const hero = `<section class="hero" style="padding-bottom:0">
  <div class="container">
    <div class="offer-chip reveal" data-intro-chip hidden>
      ✦ Launch offer · ${PRICING.introPercent}% off · <span data-seats-left>—</span> of ${PRICING.introSeats} places left
    </div>
    <h1 class="reveal" style="max-width:14ch">One plan. Everything in it.</h1>
    <p class="lede reveal" style="max-width:60ch;margin-top:22px">
      There is no tier where deadline reminders cost extra, and no add-on for inviting your
      manager. The only decision is how long you would like to pay for at a time.
    </p>
    <div class="price-line reveal" style="margin-top:44px">
      <span class="price-now figure" data-price-monthly>${inr(PRICING.introMonthly)}</span>
      <span class="price-was figure strike" data-price-list>${inr(PRICING.listMonthly)}</span>
      <span class="dim" style="font-size:18px">per month + GST</span>
    </div>
    <div class="btn-row reveal" style="margin-top:30px">
      <a class="btn btn-lg" href="${SITE.signup}">Start free — ${PRICING.trialDays} days</a>
      <a class="btn btn-lg btn-ghost" href="#included">What is included</a>
    </div>
    <p class="fine reveal">No card needed · Cancel any time · 30-day money-back guarantee</p>
    ${table}
    <p class="fine reveal" style="margin-top:16px">
      All prices in Indian rupees. Card, UPI and netbanking through Razorpay.
    </p>
  </div>
</section>`

const included = section({
  id: 'included',
  className: 'band-line',
  inner: `
    ${head({ eyebrow: 'Nothing held back', title: 'What you get', lede: 'All of it, on every term.' })}
    <div class="grid g-2 reveal" style="margin-top:40px">
      ${INCLUDED.map(([title, note]) => `<div class="card"><h4>${title}</h4><p class="dim">${note}</p></div>`).join('')}
    </div>`,
})

const straight = section({
  className: 'band-line',
  inner: `
    ${head({ eyebrow: 'The parts people get caught by', title: 'Said plainly, before you pay' })}
    <div class="grid g-3 reveal" style="margin-top:40px">
      <div class="card">
        <h4>30 days to change your mind</h4>
        <p class="dim">Cancel within 30 days of any payment and we refund it in full. We will not ask how much you used it. After that a term already provided is not refunded.</p>
      </div>
      <div class="card">
        <h4>Your price is fixed for your term</h4>
        <p class="dim">Renewal takes whatever the price is then. If the amount changes, your bank asks you to approve the new mandate first — RBI’s e-mandate rules require it, and we would do it anyway.</p>
      </div>
      <div class="card">
        <h4>A lapsed plan is read-only, not locked</h4>
        <p class="dim">Everything stays visible and exportable. Reminders keep arriving for another 30 days, because a missed deadline is not a fair punishment for a card that failed.</p>
      </div>
      <div class="card">
        <h4>We never touch your brand money</h4>
        <p class="dim">Brands pay you directly, bank to bank. Razorpay is involved in exactly one transaction: you paying us.</p>
      </div>
      <div class="card">
        <h4>A tax invoice, every time</h4>
        <p class="dim">GST at ${PRICING.gstPercent}% on top of the figures above, and an invoice carrying your GSTIN if you have one.</p>
      </div>
      <div class="card">
        <h4>Cancel from inside the app</h4>
        <p class="dim">Settings → Plan and billing, or write to <a href="mailto:${COMPANY.email}" style="color:var(--accent-text)">${COMPANY.email}</a>. No retention call.</p>
      </div>
    </div>`,
})

const questions = `<section class="band band-line">
  <div class="container">
    ${head({ eyebrow: 'Billing questions', title: 'The rest of it', align: 'center' })}
    <div style="max-width:820px;margin:44px auto 0">${faq(QUESTIONS)}</div>
  </div>
</section>`

export default {
  path: '/pricing',
  title: 'Pricing — CreatorDesk',
  description: `One plan with every feature, from ${inr(PRICING.introMonthly)} a month plus GST. ${PRICING.trialDays}-day free trial, no card required, and a 30-day money-back guarantee.`,
  schema: [faqSchema(QUESTIONS)],
  body: [
    hero,
    included,
    straight,
    questions,
    closingCta({
      title: `Try it for ${PRICING.trialDays} days first.`,
      sub: 'No card, no call, and your existing deals imported in a few minutes.',
      href: SITE.signup,
      secondary: ['Talk to us', '/contact'],
    }),
  ].join('\n'),
}
