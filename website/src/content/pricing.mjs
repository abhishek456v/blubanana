// The pricing page.
//
// One plan, so this page's job is not to help anyone choose a tier — it is to
// answer, in order: what does it cost, what do I get, what happens when I stop
// paying, and what happens to the price later. A pricing page that leaves the
// fourth question unanswered is the one people write in about.

import { COMPANY, PRICING, SITE, inr } from '../site.mjs'
import { t } from '../copy.mjs'
import { closingCta, faq, faqSchema, head, planCard, planCta, section } from '../ui.mjs'

const QUESTIONS = [
  [
    'Is the ₹1,999 a real price?',
    `It is what everyone pays once the first ${PRICING.introSeats} creators have subscribed. A discount from a price nobody is ever charged is a fabricated one, and we are not opening with that.`,
  ],
  [
    'Why are 3, 6 and 9 months not cheaper per month?',
    'They are not a discount ladder. They exist for the creator who would rather not think about it again for a while. Only the twelve month term is discounted.',
  ],
  [
    'Is GST included?',
    `No. Every figure is before GST at ${PRICING.gstPercent}%, and you get a tax invoice carrying your GSTIN if you have given us one.`,
  ],
  [
    'How many people can use one workspace?',
    `Up to ${PRICING.seats}. You choose what each of them sees, and no invited manager can delete anything.`,
  ],
  [
    'Do I need a card to start?',
    `No. The trial takes an email address and lets you create ${PRICING.trialDeals} deals.`,
  ],
]

const INCLUDED = [
  'Unlimited deals, brands, contacts and invoices',
  'Deadline and payment reminders, sent from a server',
  'Screenshot, voice and spreadsheet capture',
  'GST invoices, with a UPI code brands can scan',
  'TDS, expenses and the advance tax calculator',
  'Your rate card, built from what you have charged',
  `Up to ${PRICING.seats} people, with separate permissions`,
  'Export everything, at any time',
]

const hero = `<section class="hero" style="padding-bottom:44px">
  <div class="container">
    <div class="hero-grid">
      <div>
        <h1 class="reveal" style="max-width:13ch">${t(
          'pricing.hero.title',
          'One plan. Everything in it.'
        )}</h1>
        <p class="lede reveal" style="max-width:44ch;margin-top:18px">
          ${t(
            'pricing.hero.lede',
            'Every feature on every term. The only decision is how long you pay for at a time.'
          )}
        </p>
      </div>
      <div class="reveal">
        ${planCard({ pricing: PRICING, inr, subscribe: SITE.subscribe, trial: SITE.signup })}
      </div>
    </div>
  </div>
</section>`

const included = section({
  id: 'included',
  className: 'band-line',
  inner: `
    ${head({ eyebrow: 'Nothing held back', title: 'What you get', lede: 'All of it, on every term.' })}
    <ul class="includes reveal" style="margin-top:36px;grid-template-columns:1fr 1fr;display:grid;gap:14px 40px">
      ${INCLUDED.map((line) => `<li><span class="tick">✓</span> ${line}</li>`).join('')}
    </ul>`,
})

const straight = section({
  inner: `
    ${head({ title: 'Three things worth knowing before you pay', align: 'center' })}
    <div class="grid g-3 reveal" style="margin-top:40px">
      <div class="card">
        <h4>30 days to change your mind</h4>
        <p>Cancel within 30 days of any payment and we refund it in full, without asking how much you used it.</p>
      </div>
      <div class="card">
        <h4>Your price is fixed for your term</h4>
        <p>Renewal takes the price current then, and your bank asks you to approve any change first.</p>
      </div>
      <div class="card">
        <h4>A lapsed plan is read only, not locked</h4>
        <p>Everything stays visible and exportable, and reminders keep arriving for another 30 days.</p>
      </div>
    </div>`,
})

const questions = `<section class="band band-alt">
  <div class="container">
    ${head({ eyebrow: 'Billing questions', title: 'The rest of it', align: 'center' })}
    <div style="max-width:820px;margin:44px auto 0">${faq(QUESTIONS)}</div>
  </div>
</section>`

export default {
  path: '/pricing',
  title: 'Pricing | Blubanana',
  description: `One plan with every feature for digital content creators, from ${inr(PRICING.introMonthly)} a month plus GST. ${PRICING.trialDays} day free trial, no card required, and 30 days money back.`,
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
