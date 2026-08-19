// The comparison page.
//
// Written to a correction: the first version argued that foreign tools do not
// handle GST, which is true and beside the point. They are competent products
// built for another country, and nobody switches software over a tax field.
//
// The real gap is the work itself. Nothing else in this category reminds a
// creator before a deadline, tells her what is owed and how late, writes the
// follow up, or keeps working on a shoot with no signal. That is what this page
// compares, and the India part is stated once, plainly, at the end.

import { PRICING, SITE } from '../site.mjs'
import { closingCta, head, icon, section } from '../ui.mjs'

const ROWS = [
  ['Logs a deal from a screenshot or a voice note', false, false, true],
  ['Reminds you before a deadline, without the app open', false, true, true],
  ['Shows what is owed, and how many days late', false, true, true],
  ['Writes the payment follow up for you', false, false, true],
  ['Tracks an advance and a balance separately', false, false, true],
  ['Records what actually landed after tax was deducted', false, false, true],
  ['Builds a rate card from what you have really charged', false, false, true],
  ['Keeps working with no signal', false, false, true],
  ['Priced in rupees, on the April to March year', false, false, true],
]

const table = `<div class="table-wrap reveal" style="margin-top:36px">
  <table>
    <thead><tr>
      <th style="min-width:260px"></th>
      <th class="num-cell">A spreadsheet</th>
      <th class="num-cell">A tool built abroad</th>
      <th class="num-cell">CreatorDesk</th>
    </tr></thead>
    <tbody>
      ${ROWS.map(
        ([label, a, b, c]) => `<tr>
        <td><strong>${label}</strong></td>
        <td class="num-cell ${a ? 'yes' : 'no'}">${a ? 'Yes' : 'No'}</td>
        <td class="num-cell ${b ? 'yes' : 'no'}">${b ? 'Yes' : 'No'}</td>
        <td class="num-cell ${c ? 'yes' : 'no'}">${c ? 'Yes' : 'No'}</td>
      </tr>`
      ).join('')}
    </tbody>
  </table>
</div>`

const hero = `<section class="hero" style="padding-bottom:0">
  <div class="container">
    <h1 class="reveal" style="max-width:19ch">You already have a system. Here is what it costs you.</h1>
    <p class="lede reveal" style="max-width:54ch;margin-top:18px">
      A spreadsheet, a notes app and a good memory get most creators to about eight live deals. This is what breaks after that.
    </p>
  </div>
</section>`

const three = section({
  inner: `
    <div class="grid g-3 reveal">
      <div class="card">
        <div class="icon-badge">${icon('chart')}</div>
        <h4>A spreadsheet</h4>
        <p>Free, and completely silent. It has never once told you that a payment is late.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('doc')}</div>
        <h4>Notes and chat threads</h4>
        <p>Fine for one deal. By the eighth, the terms of the third are somewhere in a conversation from March.</p>
      </div>
      <div class="card">
        <div class="icon-badge">${icon('globe')}</div>
        <h4>A tool built abroad</h4>
        <p>Good software, written for a market where brands pay on time and the year starts in January.</p>
      </div>
    </div>
    ${table}`,
})

const india = section({
  className: 'band-alt',
  inner: `
    ${head({
      eyebrow: 'Made in India',
      title: 'The problem was worth understanding first',
      lede: 'Half the money up front and the rest whenever finance gets to it. Deals agreed in a DM at midnight. A brand that ghosts after the shoot. March arriving with no idea what is owed.',
      align: 'center',
    })}
    <p class="lede reveal center" style="max-width:600px;margin-top:22px">
      None of that is a feature request a foreign tool would ever receive. It is the whole job here.
    </p>`,
})

export default {
  path: '/compare',
  title: 'CreatorDesk compared with a spreadsheet and foreign tools',
  description:
    'How CreatorDesk compares with a spreadsheet, a notes app and business tools built for other countries, on the work that actually costs an Indian creator money.',
  body: [
    hero,
    three,
    india,
    closingCta({
      title: 'Bring your spreadsheet with you',
      sub: `The importer reads it and everything comes across. ${PRICING.trialDays} days free, no card.`,
      href: SITE.signup,
      secondary: ['See pricing', '/pricing'],
    }),
  ].join('\n'),
}
