// The product pages.
//
// One per job the product does. They exist because a creator searching for one
// specific problem, "how do I invoice a brand with GST", should land on the
// page about that and not on a homepage that mentions it in passing.
//
// Same skeleton eight times, so a fix to the shape fixes eight pages: what it
// is, why it works that way, three steps, the one detail that shows the thing
// was thought about, three questions, and where to go next.

import { PRICING, SITE } from '../site.mjs'
import { closingCta, demoApp, faq, faqSchema, head, icon, planCta, tabs } from '../ui.mjs'

const PAGES = [
  {
    slug: 'deals',
    nav: 'Logging a deal',
    eyebrow: 'Never miss a deal',
    h1: 'Log a brand deal in thirty seconds',
    line: 'Screenshot the message, say it out loud, or type it. You check it before it saves.',
    description:
      'Log a brand collaboration from a screenshot, a voice note or by typing. Blubanana reads the brief, the rate and the dates and shows them to you before anything saves.',
    screen: 'newdeal',
    why: 'A deal that never gets written down is a deal that never gets invoiced. So getting one in has to take about as long as replying to the message it arrived in.',
    steps: [
      ['Screenshot the DM', 'The brand, the deliverables, the rate and the dates are read out of the picture.'],
      ['Check what it read', 'It fills the form and waits. Nothing is saved on a machine’s say so.'],
      ['Done', 'The payment schedule, the stages and the reminders are created with it.'],
    ],
    detail: [
      'Nothing on the form is required except the brand',
      'And no field is ever labelled optional. If it can be left blank, leaving it blank is simply allowed, which is the difference between a form you finish and a form you abandon.',
    ],
    questions: [
      ['What if it reads something wrong?', 'You correct it before saving. The model proposes and you decide, on every path.'],
      ['Can I bring deals I already have?', 'Yes. Point the importer at a spreadsheet or a photo of your notes and they come across together.'],
      ['Does it work in Hindi?', 'Voice notes and screenshots in Hinglish are read correctly. Fully Devanagari text is less reliable today.'],
    ],
  },
  {
    slug: 'deadlines',
    nav: 'Deadlines',
    eyebrow: 'Never miss a deadline',
    h1: 'Reminders that arrive whether the app is open or not',
    line: 'Every stage carries a date, and your phone tells you before it passes.',
    description:
      'Name your own stages, give each one a date, and get a reminder before it passes. Sent from a server, so they arrive whether or not you have opened the app.',
    screen: 'deal',
    why: 'Most creator tools schedule reminders on the phone itself, which means they quietly stop when the app is not opened for a week. Ours are sent from a server, so a silent week changes nothing.',
    steps: [
      ['Name the stages yourself', 'Script, shoot, edit, publish is the default. Rename them, add a client review, delete what you skip.'],
      ['Give each one a date', 'Or leave it and add it later. A stage with no date simply does not remind you.'],
      ['Answer the nudge', 'Marking something done is never blocked, whatever the state of your subscription.'],
    ],
    detail: [
      'No notification ever shows an amount',
      'A lock screen is read by whoever is standing next to you, and your rates are the most sensitive thing here. "A payment from Nykaa is overdue", never the figure. There is a switch to turn amounts on, and it is off.',
    ],
    questions: [
      ['What if a deal goes quiet?', 'Put it on hold. It stops counting as expected income and stops reminding you, without leaving your records.'],
      ['Do reminders stop if I stop paying?', 'Not immediately. They keep arriving for 30 days, because a missed deadline is not a fair punishment for a card that failed.'],
      ['Can I turn categories off?', 'Each kind of reminder has its own switch: stages, payments, overdue payments, ad rights and tax dates.'],
    ],
  },
  {
    slug: 'payments',
    nav: 'Payments and chasing',
    eyebrow: 'Never miss a payment',
    h1: 'Know what is owed, and chase it without writing the message',
    line: 'The follow up is already written, and gets firmer the longer it goes.',
    description:
      'Track advances and balances separately, record what actually landed after TDS, and send a follow up that is already written. Built for how Indian brands pay.',
    screen: 'money',
    why: 'Chasing money is the part every creator postpones, and most of that is not the money. It is writing the message. So the message is already written.',
    steps: [
      ['Record the terms on the deal', 'Half up front and half on delivery is two payments with two dates, not one.'],
      ['Get told when it is late', 'Pending, then nudged, then overdue, counted in days rather than in feelings.'],
      ['Send the follow up', 'It opens in WhatsApp addressed to the right person. You read it and send it yourself.'],
    ],
    detail: [
      'It asks what actually landed',
      'Invoiced a lakh, received ninety thousand, TDS ten thousand. Three different numbers, and your tax return needs all three. Record only what arrived and you understate your income by exactly the tax you have already paid.',
    ],
    questions: [
      ['Does Blubanana handle the money?', 'No, and it never will. Brands pay you directly, bank to bank. We are not a payment processor and do not want to be one.'],
      ['What is a collection rate?', 'Of everything you invoiced this year, the share that actually arrived and how long it took. It is the number that tells you which brands to stop working with.'],
      ['Can I send the reminder myself?', 'You always do. Nothing is ever sent automatically in your name.'],
    ],
  },
  {
    slug: 'invoices',
    nav: 'Invoices',
    eyebrow: 'Getting paid',
    h1: 'An invoice the brand’s finance team accepts first time',
    line: 'Correct tax, your payment code on the document, and one tap to send it.',
    description:
      'GST invoices compliant with Rule 46, with CGST and SGST or IGST worked out from the place of supply, TDS recorded, and a UPI code the brand can scan.',
    screen: 'invoice',
    why: 'This is the only thing the product makes that anyone other than you ever looks at, and the only evidence you have if a payment is disputed. It deserves more care than a screen and it gets it.',
    steps: [
      ['Raise it from the deal', 'Your details, the brand’s details and the line items are already there.'],
      ['Adjust anything', 'Every field is editable before it is final.'],
      ['Send it on WhatsApp', 'To the person at the brand who actually replies, with the number, the amount and the due date already written.'],
    ],
    detail: [
      'The tax split is worked out, not chosen',
      'Whether an invoice carries IGST or CGST and SGST depends on your state and the place of supply. Getting it wrong means the recipient cannot claim credit against the right head, and a finance team sends it back.',
    ],
    questions: [
      ['I am not registered for GST', 'Then you get a clean invoice with no tax fields at all, rather than a GST invoice full of zeroes.'],
      ['What is the QR code?', 'A UPI code for the net payable after TDS, so the brand scans and pays exactly what it owes, straight to your bank.'],
      ['Can I get a PDF?', 'Yes. The invoice prints to a single A4 page and shares from your phone like any other file.'],
    ],
  },
  {
    slug: 'tax',
    nav: 'Tax and year end',
    eyebrow: 'March, without the panic',
    h1: 'Know what to set aside before the date, not after',
    line: 'Advance tax on the four dates the law sets, from your own income and expenses.',
    description:
      'Advance tax instalments on 15 June, 15 September, 15 December and 15 March, expenses, TDS, and an April to March summary you can hand to a CA.',
    screen: 'tax',
    why: 'Indian freelancers pay advance tax quarterly, and missing it means interest under sections 234B and 234C. Most creators find out from their accountant in March, when it is already too late to do anything about it.',
    steps: [
      ['Log your expenses', 'Editors, gear, travel, the assistant on the shoot day. That is what turns turnover into income.'],
      ['Set your rate', 'Yours, from your CA. The app will not invent a slab, because a stale one produces a wrong number that looks authoritative.'],
      ['Get reminded', 'Seven days before each advance tax date, and three before a GST filing.'],
    ],
    detail: [
      'You can add what it never saw',
      'AdSense, affiliate income, a deal paid outside the app, TDS showing in your 26AS. The report keeps both sides visible, what came from your deals and what you added, rather than letting a typo quietly replace a figure it can prove.',
    ],
    questions: [
      ['Is this tax advice?', 'No. It is arithmetic on your figures, and a starting point for you and your accountant.'],
      ['Does it file anything?', 'No. It tells you what is due and when, and hands you a summary in the shape your CA works in.'],
      ['What if I am not registered for GST?', 'Then you get no GST reminders and no GST fields. Advance tax still applies.'],
    ],
  },
  {
    slug: 'rate-card',
    nav: 'Your rate card',
    eyebrow: 'When a brand asks',
    h1: 'A rate card you did not have to write',
    line: 'Built from what you have actually charged, so you are not guessing.',
    description:
      'A shareable rate card built from the median of what you have really been paid per format, with your reach, ready to send when a brand asks for your commercials.',
    screen: 'ratecard',
    why: 'Today that is twenty minutes of copying numbers out of Instagram Insights into a document you half remember making. It is also the moment you are most likely to undersell yourself.',
    steps: [
      ['It builds itself', 'From the deals you have logged, per format.'],
      ['Pick a look', 'Seven themes, suggested from your niche. A fashion brand and a fintech brand do not get the same card.'],
      ['Send it', 'On WhatsApp, or as a file.'],
    ],
    detail: [
      'Every rate is a median, with the sample size on the card',
      'The median rather than the average, because one unusually large deal drags an average up to a price you have been paid exactly once and cannot defend in a negotiation. Saying it is drawn from eleven deals is what makes it a fact.',
    ],
    questions: [
      ['Can I change the numbers before sending?', 'Yes, including the labels. "From ₹25,000 plus travel" is a thing creators say that a form of number inputs cannot express.'],
      ['What if I have never sold that format?', 'It proposes a starting price, told what you already charge so a suggested Story never comes back above your real Reel. You decide whether it goes on.'],
      ['Is it a public web page?', 'No. It is a file you send. Nothing about your rates is published anywhere.'],
    ],
  },
  {
    slug: 'team',
    nav: 'Managers and team',
    eyebrow: 'Working with a manager',
    h1: 'Share the work without sharing your rates',
    line: 'You decide what they see, area by area. Nobody but you can delete anything.',
    description:
      'Invite a manager into your workspace and choose what they can see, area by area. Rates can be hidden completely, enforced by the database rather than the interface.',
    screen: 'team',
    why: 'A production assistant needs the deals and the deadlines and has no business seeing what you charge. Most tools solve that by not drawing the number on screen, which is not the same as not sending it.',
    steps: [
      ['Invite by email', 'They join your workspace. You can invite several.'],
      ['Set the switches', 'Deals, brands, rates, invoices, money, expenses and bank details, each on its own.'],
      ['Change your mind any time', 'Access can be narrowed or removed after the fact.'],
    ],
    detail: [
      'A hidden rate is never sent, not merely never drawn',
      'The limits you set are enforced in the database, so they hold against a direct request as well as against the screen. And no manager can delete anything, ever, whatever else is switched on.',
    ],
    questions: [
      ['How many people are included?', `Up to ${PRICING.seats} in your workspace, on every plan. More on request.`],
      ['Can a manager delete a deal by accident?', 'No. Deletion belongs to you alone, and that is a rule in the database rather than a hidden button.'],
      ['Can one manager work with several creators?', 'Yes. They are invited separately to each workspace and see only what each creator allows.'],
    ],
  },
  {
    slug: 'offline',
    nav: 'Working offline',
    eyebrow: 'On a shoot, with one bar',
    h1: 'Log a deal with no signal at all',
    line: 'It saves to your phone and syncs itself when you are back.',
    description:
      'Create deals, add brands and tick off stages with no connection. Blubanana saves them on the phone and syncs when signal returns, without losing anything.',
    screen: 'offline',
    why: 'The promise is that a deal takes thirty seconds, and the moment that matters most is not at a desk. It is on a shoot, in a basement studio, with a brand asking whether you can add two Stories.',
    steps: [
      ['Log it anyway', 'Creating a deal, adding a brand and marking a stage done all work with no connection.'],
      ['It says so plainly', '"Saved on this phone, it will sync when you have signal." It is not an error, so it is not phrased as one.'],
      ['It lands by itself', 'In the order you made things, so a deal never arrives before the brand it belongs to.'],
    ],
    detail: [
      'A screenshot taken offline is still read',
      'The picture waits on the phone and the reading happens on sync. It saves rather than asking you to check it, because offline the alternative to saving is losing the capture, and it marks itself for review so you know to look.',
    ],
    questions: [
      ['Does everything work offline?', 'No, and deliberately. Capture does. Dashboards, invoices and reports need a connection, because those are things you sit down to do.'],
      ['Could I lose something?', 'It stays on the phone until the server confirms it. If something is rejected it stays visible with the reason rather than disappearing.'],
      ['Does this work on the web?', 'This one is the phone apps only. A browser tab has no basement studio moment.'],
    ],
  },
]

function productPage(spec, all) {
  const others = all.filter((p) => p.slug !== spec.slug).slice(0, 3)

  const body = `
<section class="hero" style="padding-bottom:56px">
  <div class="container">
    <div class="hero-grid">
      <div>
        <div class="eyebrow reveal">${spec.eyebrow}</div>
        <h1 class="reveal" style="max-width:15ch;font-size:clamp(32px,4.2vw,48px)">${spec.h1}</h1>
        <p class="lede reveal" style="max-width:44ch;margin-top:18px">${spec.line}</p>
        <div class="btn-row reveal" style="margin-top:28px">
          <a class="btn btn-lg" href="${SITE.signup}">Start free for ${PRICING.trialDays} days</a>
          <a class="btn btn-lg btn-ghost" href="/pricing">See pricing</a>
        </div>
      </div>
      <div class="reveal">${demoApp({ id: spec.slug, start: spec.screen })}</div>
    </div>
  </div>
</section>

<section class="band band-alt">
  <div class="container">
    <div class="split">
      <div class="reveal"><h2 style="max-width:14ch">Why it works this way</h2></div>
      <div class="reveal"><p class="lede">${spec.why}</p></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="container">
    ${head({ title: 'How it goes', align: 'center' })}
    <div class="steps reveal" style="margin-top:40px">
      ${spec.steps.map(([title, note]) => `<div class="step"><h4>${title}</h4><p>${note}</p></div>`).join('')}
    </div>
  </div>
</section>

<section class="band band-alt">
  <div class="container">
    <div class="split">
      <div class="reveal">
        <div class="icon-badge">${icon('shield')}</div>
        <h2 style="max-width:16ch">${spec.detail[0]}</h2>
      </div>
      <div class="reveal"><p class="lede">${spec.detail[1]}</p></div>
    </div>
  </div>
</section>

<section class="band">
  <div class="container">
    ${head({ title: 'Questions', align: 'center' })}
    <div style="max-width:780px;margin:36px auto 0">${faq(spec.questions)}</div>
  </div>
</section>

<section class="band band-alt">
  <div class="container">
    ${head({ title: 'The rest of it', align: 'center' })}
    <div class="grid g-3 reveal" style="margin-top:36px">
      ${others
        .map(
          (other) => `<a class="card tool-card" href="/features/${other.slug}">
        <h4>${other.nav}</h4><p>${other.line}</p>
        <span class="link-arrow" style="margin-top:12px">Open</span>
      </a>`
        )
        .join('')}
    </div>
    <div style="max-width:420px;margin:36px auto 0">
      ${planCta({ subscribe: SITE.subscribe, trial: SITE.signup, included: '/pricing#included' })}
    </div>
  </div>
</section>`

  return {
    path: `/features/${spec.slug}`,
    title: `${spec.nav} | Blubanana`,
    description: spec.description,
    schema: [faqSchema(spec.questions)],
    body: [
      body,
      closingCta({
        title: 'Try it on the deals you already have',
        sub: `The importer brings them across in minutes.`,
        href: SITE.subscribe,
        primary: 'Subscribe',
        secondary: [`${PRICING.trialDays} day trial`, SITE.signup],
      }),
    ].join('\n'),
  }
}

export const PRODUCT_NAV = PAGES.map((p) => [`/features/${p.slug}`, p.nav, p.line])

/** The overview, so "Product" in the menu goes somewhere as well as opening. */
const overview = {
  path: '/features',
  title: 'Features | Blubanana',
  description:
    'Everything Blubanana does for a digital content creator in India: logging deals, deadlines, payments, GST invoices, tax, your rate card, managers, and working with no signal.',
  body: `
<section class="hero" style="padding-bottom:24px">
  <div class="container">
    <div class="eyebrow reveal">Features</div>
    <h1 class="reveal" style="max-width:15ch">Eight jobs, one place</h1>
    <p class="lede reveal" style="max-width:52ch;margin-top:18px">
      The work that sits between agreeing a deal and the money arriving. Pick one and it opens.
    </p>
  </div>
</section>

<section class="band" style="padding-top:24px">
  <div class="container">
    ${tabs(
      PAGES.map((page) => ({
        id: `t-${page.slug}`,
        label: page.nav,
        screen: page.screen,
        title: page.h1,
        copy: page.line,
        link: ['Read more', `/features/${page.slug}`],
      })),
      { frame: 'features-index' }
    )}
  </div>
</section>

${closingCta({
  title: 'See it with your own deals in it',
  sub: `${PRICING.trialDays} days free, no card, and the importer brings them across in minutes.`,
  href: SITE.subscribe,
  primary: 'Subscribe',
  secondary: [`${PRICING.trialDays} day trial`, SITE.signup],
})}`,
}

export default [overview, ...PAGES.map((spec) => productPage(spec, PAGES))]
