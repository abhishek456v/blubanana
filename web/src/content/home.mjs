// The homepage.
//
// Thirteen sections, and the order is an argument rather than a list: what it
// is, what it costs you today, what it looks like, the three promises in the
// order a deal actually moves, why an Indian creator cannot use a foreign
// tool, what the money really does, and only then the price.
//
// The rule this page is built to obey: never make a claim in a paragraph that
// a screenshot on the same screen could make instead.

import { PRICING, SITE, inr } from '../site.mjs'
import { closingCta, faq, faqSchema, head, points, section, shot, split, tabs } from '../ui.mjs'

const QUESTIONS = [
  [
    'Does CreatorDesk take a cut of my brand deals?',
    'No, and it never touches the money. Brands pay you directly, bank to bank — the invoice carries a UPI QR they scan. We charge a subscription and nothing else. Taking a cut would make us a payment intermediary, which is a different company with an RBI licence.',
  ],
  [
    'Do I need to be registered for GST to use it?',
    'No. Unregistered creators get a clean invoice with no tax fields on it at all — not a GST invoice with zeroes in it. If you are registered, invoices come out compliant with Rule 46, with CGST and SGST or IGST worked out from the place of supply.',
  ],
  [
    'I already track my deals in a spreadsheet. Why change?',
    'A spreadsheet is free and it will never remind you of anything. It will not tell you a payment is eleven days late, will not draft the follow-up, will not produce an invoice a finance team accepts, and in March it holds turnover rather than taxable income. Point the importer at it and everything comes across in a few minutes.',
  ],
  [
    'Can my manager use it without seeing my rates?',
    'Yes. You choose, area by area, what a manager can see — deals, brands, invoices, money, expenses, bank details, and rates separately. With rates switched off, the figures do not arrive on their device at all: it is enforced in the database, not hidden by the interface. And no manager can delete anything, ever.',
  ],
  [
    `What happens after the ${PRICING.trialDays} days?`,
    `Nothing disappears. The workspace becomes read-only — everything stays visible, and you can export all of it whenever you like — until you subscribe. Deadline and payment reminders keep arriving for another 30 days, because a missed deadline is not a reasonable punishment for a card that failed.`,
  ],
  [
    'Is my data mine?',
    'Yes. Export everything — deals, brands, payments, invoices, expenses, ratings — as CSV or JSON at any time, including while your account is read-only. Delete your account and it is genuinely deleted, not deactivated. We keep only the tax invoices Indian law requires us to keep.',
  ],
  [
    'Does it work on my phone?',
    'It is the same product on the web, on iPhone and on Android. Logging a deal, adding a brand and ticking off a stage all work with no signal at all — they save to the phone and sync themselves when you are back on a network.',
  ],
  [
    'What does it cost after the launch offer?',
    `${inr(PRICING.listMonthly)} a month plus GST, with 20% off on twelve months. The first ${PRICING.introSeats} creators pay half that, and the price you start on holds for the whole term you buy.`,
  ],
]

const hero = `<section class="hero">
  <div class="container">
    <h1 class="reveal">Every brand deal, every deadline, every rupee still owed to you.</h1>
    <p class="lede reveal">
      CreatorDesk is the business side of being a creator — built for India, where the deal
      arrives in a DM, the payment arrives late, and GST is not optional.
    </p>
    <div class="btn-row reveal">
      <a class="btn btn-lg" href="${SITE.signup}">Start free — ${PRICING.trialDays} days</a>
      <a class="btn btn-lg btn-ghost" href="#see">See how it works</a>
    </div>
    <p class="fine reveal">
      No card needed to start · Web, iPhone and Android · Export everything, any time
    </p>

    <div class="hero-art reveal">
      ${shot('home-desktop', 'The CreatorDesk dashboard: upcoming payments, money received, and the four things that need attention today', {
        sizes: '(max-width: 940px) 92vw, 940px',
        lazy: false,
      })}
      ${shot('home-phone', 'The same dashboard on a phone', { className: 'phone', sizes: '210px' })}
    </div>
  </div>
</section>`

const losses = section({
  className: 'band-line',
  inner: `
    <div class="grid g-3">
      <div class="reveal"><h3>The deal you agreed to in a DM and never invoiced.</h3></div>
      <div class="reveal"><h3>The deadline you found out about from the brand.</h3></div>
      <div class="reveal"><h3>The ₹40,000 from March that nobody ever chased.</h3></div>
    </div>
    <p class="lede reveal" style="margin-top:44px;max-width:66ch">
      Every creator running more than three collaborations at once has all three. Not from
      carelessness — from running a business out of a notes app, a chat thread and memory.
    </p>`,
})

const see = `<section id="see" class="band band-line">
  <div class="container">
    ${head({
      eyebrow: 'The product, not a promise',
      title: 'Five screens you would actually use',
      lede: 'Real screenshots from a real workspace — not a mockup of one.',
    })}
    <div style="margin-top:44px">
      ${tabs('t', [
        {
          label: 'Capture',
          title: 'A deal takes thirty seconds',
          copy: 'Screenshot the brand’s message, say it out loud, or type it. The brief, the rate, the dates and the deliverables are read out and filled in — and shown to you before anything is saved.',
          art: shot('newdeal', 'The new deal screen, offering screenshot, voice, typing and repeating a past deal', { sizes: '(max-width: 940px) 92vw, 460px' }),
          extra: points([
            ['Four ways in.', 'Screenshot, voice, typing, or repeating a deal you have done before.'],
            ['Only the brand is required.', 'Nothing else is mandatory, and nothing is ever labelled “optional”.'],
            ['It remembers the brands.', 'Including whether that one paid late last time.'],
          ]),
        },
        {
          label: 'Deadlines',
          title: 'Every stage has a date',
          copy: 'Script, shoot, edit, publish — or whatever you actually call them. Rename them, add your own, delete the ones you skip. Each carries a date, and the reminder arrives before it matters.',
          art: shot('deal-desktop', 'A deal with its stages, dates and payment schedule', { sizes: '(max-width: 940px) 92vw, 560px' }),
          extra: points([
            ['Rename them, add them, delete them.', 'A client-review round is a stage; so is a third edit pass.'],
            ['Reminders come from a server.', 'Not scheduled on your phone, where they die if you do not open the app.'],
            ['Put a stalled deal on hold.', 'It leaves your expected income without leaving your records.'],
          ]),
        },
        {
          label: 'Money',
          title: 'What is owed, and how late',
          copy: 'Advances and balances tracked separately, TDS recorded where it was withheld, and the collection rate that tells you which brands to stop working with.',
          art: shot('money-desktop', 'The money screen: still out, received, and unpaid deals', { sizes: '(max-width: 940px) 92vw, 560px' }),
          extra: points([
            ['Advance and balance, tracked apart.', 'Because 50% up front is how most Indian deals are actually written.'],
            ['TDS recorded where it happened.', 'So your gross income is not quietly understated by exactly that figure.'],
            ['A follow-up you only have to read.', 'It opens in WhatsApp. You send it; nothing is ever sent for you.'],
          ]),
        },
        {
          label: 'Invoices',
          title: 'An invoice a finance team accepts',
          copy: 'GST worked out correctly, your UPI QR on the document, and one tap to send it on WhatsApp to the right person at the brand.',
          art: shot('invoice', 'A GST invoice with line items, tax and payment details', { sizes: '(max-width: 940px) 92vw, 420px' }),
          extra: points([
            ['CGST and SGST, or IGST.', 'Decided from the place of supply, not from a dropdown you might get wrong.'],
            ['A UPI QR for the net payable.', 'After TDS — so the brand scans and pays what it actually owes.'],
            ['Not registered for GST?', 'Then a clean invoice with no tax fields, rather than one full of zeroes.'],
          ]),
        },
        {
          label: 'Tax',
          title: 'March stops being a surprise',
          copy: 'Advance tax split across the four dates the law sets, from your own income and expenses. You adjust it; it never guesses on your behalf.',
          art: shot('tax', 'The advance tax calculator, showing what to set aside and by when', { sizes: '(max-width: 940px) 92vw, 420px' }),
          extra: points([
            ['15 June, 15 Sept, 15 Dec, 15 March.', 'The dates section 211 sets, and the percentages that go with them.'],
            ['Your expenses count.', 'Editors, gear, travel — the difference between turnover and income.'],
            ['It never invents a tax rate.', 'Slabs move most budgets; a stale one is a wrong number that looks authoritative.'],
          ]),
        },
      ])}
    </div>
  </div>
</section>`

const capture = split({
  id: 'capture',
  art: shot('newdeal', 'Four ways to start a deal: screenshot, voice, typing, or repeating a past one', { sizes: '(max-width: 940px) 92vw, 480px' }),
  words: `
    <div class="eyebrow">Never miss a deal</div>
    <h2>Log it while you are still in the chat</h2>
    <p class="dim" style="margin-top:18px;font-size:17px">
      The deal that never gets written down is the deal that never gets invoiced. So getting
      one in takes about as long as replying to the message it came in.
    </p>
    ${points([
      ['Screenshot the DM.', 'The brand, the deliverables, the rate and the dates are read out of the image.'],
      ['Or say it out loud.', 'Talk through the deal walking out of a shoot; it is transcribed and filled in.'],
      ['Nothing saves silently.', 'Whatever is read out is shown to you first. The model proposes, you decide.'],
      ['Repeat a past deal.', 'Same brand, same terms, new dates — without retyping any of it.'],
      ['Bring your existing ones.', 'Point it at a spreadsheet or a photo of your notes and they all come across.'],
    ])}`,
})

const deadlines = split({
  id: 'deadlines',
  flip: true,
  art: shot('deal-desktop', 'A deal showing its stages, each with a date and a tick', { sizes: '(max-width: 940px) 92vw, 560px' }),
  words: `
    <div class="eyebrow">Never miss a deadline</div>
    <h2>Reminders that arrive whether the app is open or not</h2>
    <p class="dim" style="margin-top:18px;font-size:17px">
      Most creator tools schedule reminders on your phone, which means they quietly stop when
      you do not open the app for a week. Ours are sent from a server.
    </p>
    ${points([
      ['Stages you name yourself.', 'Some people script and shoot the same day. Some have three edit passes and a client review.'],
      ['A date on every stage.', 'And a nudge before it passes, not after.'],
      ['No amount on your lock screen.', '“Payment from Nixel Tech is overdue” — never the figure. Your rates are the most sensitive thing here.'],
      ['Works with no signal.', 'On a shoot, in a basement studio, one bar. Log it anyway; it syncs itself later.'],
      ['A deal that stalls stops counting.', 'Put it on hold and it leaves your expected income without disappearing.'],
    ])}`,
})

const money = split({
  id: 'money',
  art: shot('money-desktop', 'Money: still out, received this month, and every unpaid deal', { sizes: '(max-width: 940px) 92vw, 560px' }),
  words: `
    <div class="eyebrow">Never miss a payment</div>
    <h2>Know exactly what is owed, and chase it without the dread</h2>
    <p class="dim" style="margin-top:18px;font-size:17px">
      Chasing money is the part every creator postpones. Most of that is not the money — it is
      writing the message. So the message is already written.
    </p>
    ${points([
      ['50% advance, 50% on delivery.', 'Each instalment tracked separately, with its own due date.'],
      ['What actually landed.', 'Invoiced ₹1,00,000, received ₹90,000, TDS ₹10,000 — three different numbers, and your return needs all three.'],
      ['A follow-up ready to send.', 'It escalates in firmness the longer it goes. It opens in WhatsApp; you read it and send it yourself.'],
      ['Your collection rate.', 'Of everything invoiced this year, what share actually arrived — and how long it took.'],
    ])}`,
})

const india = `<section id="invoices" class="band band-line">
  <div class="container">
    ${head({
      eyebrow: 'Built for India, not translated for it',
      title: 'The seven things a foreign tool gets wrong',
      lede: 'None of this is a setting you configure. It is what the product is.',
    })}
    <div class="bento reveal" style="margin-top:46px">
      <div class="card wide">
        <h4>GST invoices to Rule 46</h4>
        <p class="dim">Every field the rule requires, in the order it requires them — and CGST and SGST or IGST decided from the place of supply, not from a dropdown you might get wrong.</p>
      </div>
      <div class="card wide">
        <h4>A UPI QR on the invoice</h4>
        <p class="dim">The brand scans and pays you directly. It encodes the net payable after TDS, so they pay what they actually owe.</p>
      </div>
      <div class="card"><h4>TDS, recorded properly</h4><p class="dim">Not silently folded into the amount, where it would understate your gross income by exactly the figure you need in March.</p></div>
      <div class="card"><h4>₹1,00,000</h4><p class="dim">Indian digit grouping everywhere. Never ₹100,000.</p></div>
      <div class="card"><h4>Not registered for GST?</h4><p class="dim">Then a clean invoice with no tax fields at all — not a GST invoice full of zeroes.</p></div>
      <div class="card wide"><h4>The financial year runs April to March</h4><p class="dim">So does the annual report, the advance-tax schedule and every total in it.</p></div>
      <div class="card wide"><h4>Advance tax on the four dates in the statute</h4><p class="dim">15 June, 15 September, 15 December, 15 March. Miss them and it is interest under sections 234B and 234C — which most creators hear about from their CA in March.</p></div>
    </div>

    <div class="split" style="margin-top:64px;align-items:center">
      <div class="reveal">${shot('invoice', 'A GST invoice: line items, tax split, and the UPI payment details', { sizes: '(max-width: 940px) 92vw, 420px' })}</div>
      <div class="reveal">
        <h3>This is what the brand’s finance team receives</h3>
        <p class="dim" style="margin-top:16px;font-size:17px">
          It is the only thing this product makes that someone other than you ever looks at,
          and the only evidence you have if a payment is ever disputed. It is worth more care
          than a screen, and it gets it.
        </p>
        <p class="dim" style="font-size:17px">
          One tap opens WhatsApp to the right person at the brand, with the number, the amount
          and the due date already written.
        </p>
      </div>
    </div>
  </div>
</section>`

const waterfall = `<section id="tax" class="band band-line">
  <div class="container">
    <div class="split">
      <div class="reveal">
        ${head({
          eyebrow: 'The number nobody works out',
          title: 'What ₹1,00,000 actually becomes',
        })}
        <p class="dim" style="margin-top:22px;font-size:17px">
          A brand agrees ₹1,00,000. You are registered for GST and they deduct TDS at 10%
          under section 194J. Four different figures matter, and only one of them is yours.
        </p>
        <p class="dim" style="font-size:17px">
          CreatorDesk holds all four — which is the difference between knowing your turnover
          and knowing what you are taxed on.
        </p>
        <a class="link-arrow" href="${SITE.signup}" style="margin-top:8px">Work out yours</a>
      </div>
      <div class="reveal">
        <div class="fall">
          <div class="fall-row"><span class="l">Agreed with the brand<small>Your rate for the deliverables</small></span><span class="n">₹1,00,000</span></div>
          <div class="fall-row add"><span class="l">GST at 18%<small>You collect it; it is never your income</small></span><span class="n">+ ₹18,000</span></div>
          <div class="fall-row"><span class="l">Invoice total<small>What the invoice says</small></span><span class="n">₹1,18,000</span></div>
          <div class="fall-row sub"><span class="l">TDS withheld at 10%<small>Deducted on the base, not on the GST</small></span><span class="n">− ₹10,000</span></div>
          <div class="fall-row total"><span class="l">Lands in your bank<small>And ₹10,000 sits against your PAN until you claim it</small></span><span class="n">₹1,08,000</span></div>
        </div>
        <p class="fine" style="margin-top:16px">
          Illustrative, at the common rates for a creator’s services. The app works it out from
          your own deals, and never guesses a rate it cannot know.
        </p>
      </div>
    </div>

    <div class="split" style="margin-top:80px">
      <div class="reveal">${shot('tax', 'The advance tax calculator: taxable income, expected tax, and the four instalments', { sizes: '(max-width: 940px) 92vw, 400px' })}</div>
      <div class="reveal">
        <h3>And what to set aside, by when</h3>
        <p class="dim" style="margin-top:16px;font-size:17px">
          It starts from your real income and your real expenses, then hands you the wheel: add
          the AdSense it never saw, the deal paid outside it, the expense you paid in cash.
        </p>
        ${points([
          ['It never invents a tax rate.', 'Slabs change most budgets, and a stale one produces a wrong number that looks authoritative.'],
          ['Expenses count.', 'Editors, gear, travel, the assistant on the shoot day. That is the difference between turnover and income.'],
          ['A year-end report you can hand a CA.', 'Gross and net, income, TDS and GST, April to March.'],
        ])}
      </div>
    </div>
  </div>
</section>`

const ratecard = split({
  id: 'ratecard',
  flip: true,
  art: shot('ratecard', 'A rate card showing followers and rates per deliverable', { sizes: '(max-width: 940px) 92vw, 420px' }),
  words: `
    <div class="eyebrow">When a brand asks for your commercials</div>
    <h2>A rate card you did not have to write</h2>
    <p class="dim" style="margin-top:18px;font-size:17px">
      Today that is twenty minutes of copying numbers out of Instagram Insights into a document
      you half-remember making. It is also the moment you are most likely to undersell yourself.
    </p>
    ${points([
      ['Every rate is a median of what you have actually charged.', 'With the sample size printed on the card — which is what makes it a fact you can defend rather than a number you hope for.'],
      ['Seven themes.', 'Suggested from your niche, changed with a picker. A fashion brand and a fintech brand do not get the same card.'],
      ['Everything is editable before you send it.', '“From ₹25,000 + travel” is a thing creators say. A form of number inputs cannot express it.'],
      ['It refreshes itself.', 'A card you maintain by hand is stale in weeks, and a stale card is worse than none.'],
    ])}`,
})

const privacy = section({
  className: 'band-line',
  inner: `
    <div class="split">
      <div class="reveal">
        ${head({ eyebrow: 'Your rates are nobody else’s business', title: 'Privacy that is enforced, not promised' })}
        <p class="dim" style="margin-top:22px;font-size:17px">
          What you charge is the most sensitive thing this app holds. Most tools treat it as
          ordinary data with a nice privacy policy attached. These are boundaries in the
          database, which is the only kind that survives a determined API call.
        </p>
      </div>
      <div class="reveal">
        <div class="grid" style="gap:16px">
          <div class="card"><h4>Notifications never show an amount</h4><p class="dim">Lock screens are read by whoever is standing next to you. There is a switch to turn it on; it is off.</p></div>
          <div class="card"><h4>A manager sees only what you grant</h4><p class="dim">Seven separate switches. With rates off, the figures do not arrive on their device at all.</p></div>
          <div class="card"><h4>No manager can delete anything</h4><p class="dim">Ever, whatever else is switched on. Enforced by a row-level policy, not by a hidden button.</p></div>
          <div class="card"><h4>Your workspace is yours alone</h4><p class="dim">No creator can see another’s deals, brands, rates or earnings. Nothing crosses that line.</p></div>
        </div>
      </div>
    </div>`,
})

const mobile = section({
  className: 'band-line',
  inner: `
    <div class="split">
      <div class="reveal" style="display:flex;gap:20px;justify-content:center">
        ${shot('home-phone', 'CreatorDesk on a phone', { className: 'phone', sizes: '220px' })}
        ${shot('money-phone', 'The money screen on a phone', { className: 'phone', sizes: '220px' })}
      </div>
      <div class="reveal">
        ${head({ eyebrow: 'Where the work actually happens', title: 'On your phone, and off the grid' })}
        <p class="dim" style="margin-top:22px;font-size:17px">
          The moment that matters most is not at a desk. It is on a shoot, in a basement studio,
          with one bar of signal and a brand asking whether you can add two Stories.
        </p>
        ${points([
          ['Log the deal anyway.', 'It saves to the phone and syncs when you are back. It is never phrased as a failure, because it is not one.'],
          ['Same product everywhere.', 'Web, iPhone and Android — one account, one set of data.'],
          ['The apps are in review.', 'Until they land, everything here works in any browser on your phone.'],
        ])}
      </div>
    </div>`,
})

const pricing = section({
  className: 'band-line',
  inner: `
    <div class="split" style="align-items:center">
      <div class="reveal">
        ${head({ eyebrow: 'One plan', title: 'Everything, for one price' })}
        <p class="dim" style="margin-top:22px;font-size:17px">
          There is no tier where deadline reminders are a paid extra. A second plan would have to
          be carved out of what is already built, and the only thing that scales with a creator’s
          size is how many people are in the workspace.
        </p>
        <a class="link-arrow" href="/pricing">See the full pricing</a>
      </div>
      <div class="reveal">
        <div class="price-card">
          <div class="offer-chip" data-intro-chip hidden>
            ✦ Launch offer · <span data-seats-left>—</span> of ${PRICING.introSeats} places left
          </div>
          <div class="price-line">
            <span class="price-now figure" data-price-monthly>${inr(PRICING.introMonthly)}</span>
            <span class="price-was figure strike" data-price-list>${inr(PRICING.listMonthly)}</span>
          </div>
          <p class="dim" style="font-size:16px">
            per month + ${PRICING.gstPercent}% GST · or ${inr(PRICING.terms[4].intro)} for twelve months,
            which works out at ${inr(PRICING.terms[4].perMonth)} a month
          </p>
          <ul class="includes" style="margin:26px 0">
            <li><span class="tick">✓</span> Every feature, with nothing held back</li>
            <li><span class="tick">✓</span> Up to ${PRICING.seats} people in your workspace</li>
            <li><span class="tick">✓</span> Unlimited deals, brands, invoices and expenses</li>
            <li><span class="tick">✓</span> Your data exportable at any time</li>
          </ul>
          <a class="btn" style="width:100%" href="${SITE.signup}">Start your ${PRICING.trialDays}-day trial</a>
          <p class="fine" style="margin-top:14px">
            No card to start. ${PRICING.trialDeals} deals during the trial, everything else unlimited.
          </p>
        </div>
      </div>
    </div>`,
})

const questions = `<section id="faq" class="band band-line">
  <div class="container">
    ${head({ eyebrow: 'Before you ask', title: 'Questions creators actually ask', align: 'center' })}
    <div style="max-width:820px;margin:44px auto 0">${faq(QUESTIONS)}</div>
  </div>
</section>`

export default {
  path: '/',
  title: 'CreatorDesk — the business side of being a creator',
  description:
    'Track every brand deal, never miss a deadline, invoice with GST, and get paid on time. Built for Indian creators, on the web, iPhone and Android.',
  schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'CreatorDesk',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      description: 'Business management for Indian content creators: brand deals, deadlines, GST invoices, payments and tax.',
      offers: {
        '@type': 'Offer',
        price: String(PRICING.introMonthly),
        priceCurrency: 'INR',
        description: `Launch offer: 50% off for the first ${PRICING.introSeats} creators`,
      },
    },
    faqSchema(QUESTIONS),
  ],
  body: [
    hero,
    losses,
    see,
    capture,
    deadlines,
    money,
    india,
    waterfall,
    ratecard,
    privacy,
    mobile,
    pricing,
    questions,
    closingCta({
      title: 'Start with the eight deals you already have.',
      sub: `${PRICING.trialDays} days, no card, and the importer brings them across in a few minutes.`,
      href: SITE.signup,
      secondary: ['See pricing', '/pricing'],
    }),
  ].join('\n'),
}
