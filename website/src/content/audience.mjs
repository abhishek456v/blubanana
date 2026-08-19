// Who it is for, in their own words.
//
// The same product argued three times, because an Instagram creator, a YouTube
// creator and a manager are not looking for the same thing and do not use the
// same words for it. A page that says "creators" to all three says nothing
// specific to any of them.

import { PRICING, SITE } from '../site.mjs'
import { closingCta, demoApp, faq, faqSchema, head, icon, planCta, section } from '../ui.mjs'

const PAGES = [
  {
    slug: 'instagram-creators',
    nav: 'Instagram creators',
    h1: 'For Instagram creators',
    line: 'Reels, Stories and the campaign that ran three weeks after the brief.',
    description:
      'Blubanana for Instagram creators in India: log a deal from a DM, track Reels and Stories to their deadlines, invoice with GST, and get paid without chasing.',
    screen: 'newdeal',
    points: [
      ['The deal arrives in a DM', 'Screenshot it. The brand, the deliverables and the rate are read out and shown to you.'],
      ['A Reel is not one deadline', 'Script, shoot, edit, publish, each with its own date and its own nudge.'],
      ['Stories expire, the usage does not', 'Ad rights are captured with the fee, the duration and the expiry, and you get told before it runs out.'],
      ['Your rate card, from your real deals', 'Per Reel, per Story set, per carousel, as a median of what you have actually charged.'],
    ],
    questions: [
      ['Does it connect to my Instagram?', 'It is built to, and it is waiting on Meta approving the app. Until then the follower and view figures on your rate card are the ones you enter.'],
      ['Can it post for me?', 'No. It never publishes anything. It tracks the work and the money around it.'],
      ['What about barter deals?', 'Log the deal with a rate of zero and a note. It still carries its deadlines, and it stays out of your income figures.'],
    ],
  },
  {
    slug: 'youtube-creators',
    nav: 'YouTube creators',
    h1: 'For YouTube creators',
    line: 'Integrations, dedicated videos, and the invoice that has to survive a finance team.',
    description:
      'Blubanana for YouTube creators in India: track integrations and dedicated videos to their deadlines, invoice with GST and TDS, and know what you are owed.',
    screen: 'deal',
    points: [
      ['A video is a month of work', 'Every stage gets a date, including the ones a brand never sees.'],
      ['Bigger deals, longer terms', 'Half up front and the balance sixty days after publish is two payments with two dates, tracked apart.'],
      ['Their finance team is strict', 'The invoice carries the right tax heads, your PAN and GSTIN, and a payment code they can scan.'],
      ['AdSense belongs in the year end', 'Add what the app never saw, so the figure you hand your CA is your whole income.'],
    ],
    questions: [
      ['Does it pull my YouTube views?', 'Not yet. The Instagram side is built and waiting on approval; YouTube is a separate integration with Google and is honest about being manual today.'],
      ['Can I track a multi video deal?', 'Yes. A retainer captures the length and the per month count and generates the months, each a real deal with its own deadlines.'],
      ['What about a brand paying in dollars?', 'A deal can be in another currency, with the rupee value recorded at the time, because your tax return needs rupees and last year’s dollar cannot be revalued at today’s rate.'],
    ],
  },
  {
    slug: 'managers',
    nav: 'Managers',
    h1: 'For managers and small agencies',
    line: 'Run the work without holding the creator’s rates or their bank details.',
    description:
      'Blubanana for creator managers: see the deals and deadlines you need, with rates and bank details hidden if the creator prefers, and no way to delete anything.',
    screen: 'team',
    points: [
      ['You are invited, not registered', 'The creator owns the workspace and invites you into it. You can be invited to several.'],
      ['They choose what you see', 'Seven areas, each on its own switch. Deals and deadlines without rates is a normal setup.'],
      ['A hidden rate is never sent', 'The limits are enforced in the database, so they hold against anything, not just against the screen.'],
      ['Nothing you do can delete a record', 'Deletion belongs to the creator alone. That is a rule in the database, not a missing button.'],
    ],
    questions: [
      ['Can I work with several creators?', 'Yes, and each invites you separately. You see only what each of them allows.'],
      ['Who pays?', 'The creator, on their own workspace. Your seat is included in their plan.'],
      ['Can I see what a creator earns?', 'Only if they switch it on. Rates, invoices, the money dashboard and bank details are four separate permissions.'],
    ],
  },
]

function audiencePage(spec) {
  const body = `
<section class="hero" style="padding-bottom:56px">
  <div class="container">
    <div class="hero-grid">
      <div>
        <div class="eyebrow reveal">Made for you</div>
        <h1 class="reveal" style="max-width:14ch;font-size:clamp(32px,4.2vw,48px)">${spec.h1}</h1>
        <p class="lede reveal" style="max-width:44ch;margin-top:18px">${spec.line}</p>
        <div class="btn-row reveal" style="margin-top:28px">
          <a class="btn btn-lg" href="${SITE.signup}">Start free for ${PRICING.trialDays} days</a>
          <a class="btn btn-lg btn-ghost" href="/features">See the features</a>
        </div>
      </div>
      <div class="reveal">${demoApp({ id: spec.slug, start: spec.screen })}</div>
    </div>
  </div>
</section>

<section class="band band-alt">
  <div class="container">
    ${head({ title: 'What it changes', align: 'center' })}
    <div class="grid g-2 reveal" style="margin-top:40px">
      ${spec.points.map(([title, note]) => `<div class="card"><div class="icon-badge">${icon('bolt')}</div><h4>${title}</h4><p>${note}</p></div>`).join('')}
    </div>
  </div>
</section>

<section class="band">
  <div class="container">
    ${head({ title: 'Questions', align: 'center' })}
    <div style="max-width:780px;margin:36px auto 0">${faq(spec.questions)}</div>
    <div style="max-width:420px;margin:40px auto 0">
      ${planCta({ subscribe: SITE.subscribe, trial: SITE.signup, included: '/pricing#included' })}
    </div>
  </div>
</section>`

  return {
    path: `/for/${spec.slug}`,
    title: `${spec.nav} | Blubanana`,
    description: spec.description,
    schema: [faqSchema(spec.questions)],
    body: [
      body,
      closingCta({
        title: 'Bring the deals you already have',
        sub: 'The importer reads a spreadsheet or a photo of your notes.',
        href: SITE.subscribe,
        primary: 'Subscribe',
        secondary: [`${PRICING.trialDays} day trial`, SITE.signup],
      }),
    ].join('\n'),
  }
}

export const AUDIENCE_NAV = PAGES.map((p) => [`/for/${p.slug}`, p.nav, p.line])
export default PAGES.map(audiencePage)
