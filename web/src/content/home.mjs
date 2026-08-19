// The homepage.
//
// Two rules it is written to obey, both of them corrections.
//
// One line per idea. The previous version explained every feature in a
// paragraph and three sub points, which is how a spec reads, not how a page
// reads. If a section needs a second sentence to land, the first sentence is
// wrong.
//
// No screenshots. The app's interface is not final, and a real workspace on a
// public page would carry a creator's brands, rates and bank details with it.
// The drawings in ui.mjs show the shape of the product instead.

import { PRICING, SITE, inr } from '../site.mjs'
import {
  closingCta, faq, faqSchema, head, icon, section, split, tabs,
  uiCapture, uiDashboard, uiDeal, uiInvoice, uiMoney, uiRateCard, uiReminders, uiTaxCalendar, uiTeam,
} from '../ui.mjs'

const QUESTIONS = [
  [
    'Does CreatorDesk take a cut of my deals?',
    'No. Brands pay you directly, bank to bank. We charge a subscription and nothing else.',
  ],
  [
    'Do I need to be registered for GST?',
    'No. If you are not registered you get a clean invoice with no tax fields on it at all.',
  ],
  [
    'I use a spreadsheet already. Why change?',
    'A spreadsheet will never remind you of anything, and it cannot chase a payment. Point the importer at it and everything comes across in a few minutes.',
  ],
  [
    'Can my manager use it without seeing my rates?',
    'Yes. You choose what they see, area by area, and with rates switched off the figures never reach their device.',
  ],
  [
    `What happens after the ${PRICING.trialDays} days?`,
    'Your workspace becomes read only. Everything stays visible and exportable until you subscribe.',
  ],
  [
    'Is my data mine?',
    'Yes. Export all of it whenever you like, and deleting your account genuinely deletes it.',
  ],
]

const hero = `<section class="hero">
  <div class="container">
    <div class="hero-grid">
      <div>
        <h1 class="reveal" style="max-width:20ch">Brand deals, deadlines and payments. One app, made for Indian creators.</h1>
        <p class="lede reveal">Log a deal in thirty seconds, never miss a deadline, and get paid without chasing.</p>
        <div class="btn-row reveal">
          <a class="btn btn-lg" href="${SITE.signup}">Start free for ${PRICING.trialDays} days</a>
          <a class="btn btn-lg btn-ghost" href="#capture">See how it works</a>
        </div>
        <p class="fine reveal">No card needed. Works on the web, iPhone and Android.</p>
      </div>
      <div class="reveal">${uiDashboard()}</div>
    </div>
  </div>
</section>`

const promises = section({
  className: 'band-alt',
  inner: `
    <div class="grid g-3 reveal">
      <div class="card">
        <div class="icon-badge">${icon('bolt')}</div>
        <h4>Never miss a deal</h4>
        <p>Screenshot the message, or say it out loud. It is logged in thirty seconds.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('bell')}</div>
        <h4>Never miss a deadline</h4>
        <p>Every stage has a date, and your phone tells you before it passes.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('wallet')}</div>
        <h4>Never miss a payment</h4>
        <p>You always know what is owed, how late it is, and what to send.</p>
      </div>
    </div>`,
})

const features = section({
  id: 'features',
  inner: `
    ${head({
      eyebrow: 'What it does',
      title: 'Six jobs, one place',
      lede: 'The work that sits between agreeing a deal and the money arriving.',
    })}
    ${tabs([
      {
        id: 'capture',
        label: 'Log a deal',
        title: 'A deal takes thirty seconds',
        copy: 'Screenshot the brand’s message, say it out loud, or type it. You check it before it saves.',
        art: uiCapture(),
      },
      {
        id: 'deadlines',
        label: 'Deadlines',
        title: 'Reminders that actually arrive',
        copy: 'Sent from our servers, so they reach you whether or not the app is open, and even when the shoot had no signal.',
        art: uiReminders(),
      },
      {
        id: 'money',
        label: 'Payments',
        title: 'Chase without writing the message',
        copy: 'The follow up is already written and gets firmer the longer it goes. You read it and send it yourself.',
        art: uiMoney(),
      },
      {
        id: 'invoices',
        label: 'Invoices',
        title: 'Accepted first time',
        copy: 'Correct tax, your payment code on the document, and one tap to send it on WhatsApp.',
        art: uiInvoice(),
      },
      {
        id: 'tax',
        label: 'Tax',
        title: 'Know before the date, not after',
        copy: 'Your income, your expenses, and the four dates the law sets, worked out as you go.',
        art: uiTaxCalendar(),
      },
      {
        id: 'ratecard',
        label: 'Rate card',
        title: 'A rate card you did not have to write',
        copy: 'Built from what you have actually charged, so you are not guessing when a brand asks.',
        art: uiRateCard(),
      },
    ])}`,
})

const steps = section({
  className: 'band-alt',
  inner: `
    ${head({ eyebrow: 'How it goes', title: 'Three steps, then it runs itself', align: 'center' })}
    <div class="steps reveal" style="margin-top:44px">
      <div class="step"><h4>Bring what you already have</h4><p>Point it at your spreadsheet or a photo of your notes. Every live deal comes across.</p></div>
      <div class="step"><h4>Log the next one in the chat</h4><p>Screenshot the message. The brief, the rate and the dates are read out for you to check.</p></div>
      <div class="step"><h4>Answer your phone</h4><p>It tells you what is due, what is late, and what to send. You approve every message.</p></div>
    </div>`,
})

const team = split({
  id: 'team',
  art: uiTeam(),
  words: `
    <div class="eyebrow">Working with a manager</div>
    <h2>Share the work without sharing your rates</h2>
    <p class="lede" style="margin-top:16px">You decide what they see, area by area, and nobody but you can delete anything.</p>`,
})

const COMPARE = [
  ['Reminds you before a deadline', false, true, true],
  ['Tells you what is owed, and how late', false, true, true],
  ['Writes the payment follow up for you', false, false, true],
  ['Builds a rate card from your real deals', false, false, true],
  ['Keeps working when you have no signal', false, false, true],
  ['Priced in rupees, and knows the year runs April to March', false, false, true],
]

const compare = section({
  inner: `
    ${head({
      eyebrow: 'Why not the alternatives',
      title: 'Built by people who understand the problem',
      lede: 'Foreign tools are good software written for a different country. A spreadsheet is free and silent.',
    })}
    <div class="table-wrap reveal" style="margin-top:36px">
      <table>
        <thead><tr><th></th><th class="num-cell">Spreadsheet</th><th class="num-cell">A foreign tool</th><th class="num-cell">CreatorDesk</th></tr></thead>
        <tbody>
          ${COMPARE.map(
            ([label, a, b, c]) => `<tr>
            <td><strong>${label}</strong></td>
            <td class="num-cell ${a ? 'yes' : 'no'}">${a ? 'Yes' : 'No'}</td>
            <td class="num-cell ${b ? 'yes' : 'no'}">${b ? 'Yes' : 'No'}</td>
            <td class="num-cell ${c ? 'yes' : 'no'}">${c ? 'Yes' : 'No'}</td>
          </tr>`
          ).join('')}
        </tbody>
      </table>
    </div>
    <div class="btn-row reveal" style="margin-top:26px"><a class="link-arrow" href="/compare">See the full comparison</a></div>`,
})

const india = section({
  className: 'band-alt',
  inner: `
    <div class="split">
      <div class="reveal">
        <div class="eyebrow">Made in India</div>
        <h2>For how creators here actually work</h2>
        <p class="lede" style="margin-top:16px">Deals arrive in a DM, half the money comes up front, the rest arrives late, and nobody thinks about tax until March.</p>
      </div>
      <div class="reveal">
        <div class="grid g-2">
          <div class="card"><div class="icon-badge">${icon('phone')}</div><h4>WhatsApp, not email</h4><p>Invoices and follow ups go where brands actually reply.</p></div>
          <div class="card"><div class="icon-badge">${icon('wallet')}</div><h4>Paid straight to your bank</h4><p>A code on the invoice they scan. The money never passes through us.</p></div>
          <div class="card"><div class="icon-badge">${icon('calendar')}</div><h4>April to March</h4><p>The financial year the rest of your paperwork uses.</p></div>
          <div class="card"><div class="icon-badge">${icon('globe')}</div><h4>Rupees, written properly</h4><p>Lakhs and crores, grouped the way you read them.</p></div>
        </div>
      </div>
    </div>`,
})

const pricing = section({
  inner: `
    <div class="split" style="align-items:center">
      <div class="reveal">
        ${head({ eyebrow: 'One plan', title: 'Everything, for one price' })}
        <p class="lede" style="margin-top:16px">No tier where reminders cost extra, and no add on for inviting your manager.</p>
        <div class="btn-row" style="margin-top:24px"><a class="link-arrow" href="/pricing">See the full pricing</a></div>
      </div>
      <div class="reveal">
        <div class="price-card">
          <div class="offer-chip" data-intro-chip hidden>Launch offer, ${PRICING.introPercent}% off</div>
          <div class="price-line">
            <span class="price-now figure" data-price-monthly>${inr(PRICING.introMonthly)}</span>
            <span class="price-was figure strike" data-price-list>${inr(PRICING.listMonthly)}</span>
          </div>
          <p class="dim" style="font-size:16px">per month plus GST, or ${inr(PRICING.terms[4].intro)} for the year</p>
          <ul class="includes" style="margin:24px 0">
            <li><span class="tick">${icon('check', { size: 15, stroke: 2.4 })}</span> Every feature, nothing held back</li>
            <li><span class="tick">${icon('check', { size: 15, stroke: 2.4 })}</span> Up to ${PRICING.seats} people in your workspace</li>
            <li><span class="tick">${icon('check', { size: 15, stroke: 2.4 })}</span> Unlimited deals, brands and invoices</li>
            <li><span class="tick">${icon('check', { size: 15, stroke: 2.4 })}</span> 30 day money back guarantee</li>
          </ul>
          <a class="btn" style="width:100%" href="${SITE.signup}">Start your ${PRICING.trialDays} day trial</a>
        </div>
      </div>
    </div>`,
})

const questions = section({
  id: 'faq',
  className: 'band-alt',
  inner: `
    ${head({ title: 'Questions creators ask', align: 'center' })}
    <div style="max-width:780px;margin:36px auto 0">${faq(QUESTIONS)}</div>`,
})

export default {
  path: '/',
  title: 'CreatorDesk, the business app for Indian creators',
  description:
    'Track every brand deal, hit every deadline and get paid on time. Invoices, reminders, payments and tax in one app, made for creators in India.',
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'CreatorDesk',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      description: 'Business management for Indian content creators: brand deals, deadlines, invoices, payments and tax.',
      offers: { '@type': 'Offer', price: String(PRICING.introMonthly), priceCurrency: 'INR' },
    },
    faqSchema(QUESTIONS),
  ],
  body: [
    hero, promises, features, steps, team, compare, india, pricing, questions,
    closingCta({
      title: 'Start with the deals you already have',
      sub: `${PRICING.trialDays} days free, no card, and the importer brings them across in minutes.`,
      href: SITE.signup,
      secondary: ['See pricing', '/pricing'],
    }),
  ].join('\n'),
}
