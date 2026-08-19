// Section builders, and the drawings that stand in for screenshots.
//
// Nothing on this site is a photograph of a real workspace. The app's interface
// is not finished, so a screenshot would date the site every time a screen
// moves; and a screenshot of a working account carries a creator's business on
// it, which is not ours to publish. These draw the shape of the product
// instead: no names, no brands, no account numbers, no rupee figures. Where a
// quantity matters, it is a proportion.

import { CREATOR, DEALS, INVOICE, MONEY, RATES, REMINDERS, TODAY } from './demo.mjs'

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* ── icons ─────────────────────────────────────────────────────────────── */
const PATHS = {
  camera: '<path d="M3 8a2 2 0 0 1 2-2h2l1.2-2h5.6L15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><circle cx="11" cy="12" r="3.2"/>',
  mic: '<rect x="8.4" y="3" width="5.2" height="10" rx="2.6"/><path d="M5.5 11a5.5 5.5 0 0 0 11 0M11 16.5V19"/>',
  keyboard: '<rect x="2.6" y="6" width="16.8" height="12" rx="2.4"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M7 14h8"/>',
  bell: '<path d="M6 9a5 5 0 0 1 10 0c0 4 1.6 5.4 1.6 5.4H4.4S6 13 6 9Z"/><path d="M9.2 17.6a2 2 0 0 0 3.6 0"/>',
  doc: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h5L17 8.4v10.1A1.5 1.5 0 0 1 15.5 20h-9A1.5 1.5 0 0 1 5 18.5v-14Z"/><path d="M11.4 3v5.6H17"/>',
  wallet: '<rect x="3" y="6" width="16" height="11" rx="2.4"/><path d="M3 10h16M15 13.5h1.6"/>',
  check: '<path d="M4.5 11.5 9 16l9.5-9.5"/>',
  calendar: '<rect x="3.4" y="5.4" width="15.2" height="13.2" rx="2.2"/><path d="M3.4 9.6h15.2M7.6 3.4v3.4M14.4 3.4v3.4"/>',
  users: '<circle cx="8.4" cy="8.4" r="3.2"/><path d="M2.6 18.4c0-3 2.6-4.8 5.8-4.8s5.8 1.8 5.8 4.8"/><path d="M15 6.2a3 3 0 0 1 0 5.6M16.6 18.4c0-2 .3-3.2-1-4.2"/>',
  shield: '<path d="M11 3 4.6 5.6v5.2c0 4 2.6 7 6.4 8.2 3.8-1.2 6.4-4.2 6.4-8.2V5.6L11 3Z"/>',
  phone: '<rect x="6" y="2.6" width="10" height="16.8" rx="2.4"/><path d="M9.4 16.6h3.2"/>',
  chart: '<path d="M4 18V9M9.4 18V4.6M14.8 18v-6.4M20 18H2.4"/>',
  bolt: '<path d="M12.4 2.6 5 12.4h5l-1.4 7 7.4-9.8h-5l1.4-7Z"/>',
  globe: '<circle cx="11" cy="11" r="8"/><path d="M3 11h16M11 3c2.2 2.4 3.2 5.2 3.2 8s-1 5.6-3.2 8c-2.2-2.4-3.2-5.2-3.2-8s1-5.6 3.2-8Z"/>',
  refresh: '<path d="M18 6.4V11h-4.6"/><path d="M17.4 11a6.6 6.6 0 1 1-1.8-4.6L18 8.8"/>',
  back: '<path d="M13.4 4.6 7 11l6.4 6.4"/>',
}

export function icon(name, { size = 20, stroke = 1.7 } = {}) {
  return `<svg viewBox="0 0 22 22" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`
}

/* ── sections ──────────────────────────────────────────────────────────── */
export function section({ id, className = '', inner, container = true }) {
  const body = container ? `<div class="container">${inner}</div>` : inner
  return `<section${id ? ` id="${id}"` : ''} class="band ${className}">${body}</section>`
}

export function head({ eyebrow, title, lede, align = 'left' }) {
  const style = align === 'center' ? 'max-width:640px;margin:0 auto;text-align:center' : 'max-width:640px'
  return `<div class="reveal" style="${style}">
    ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
    <h2>${title}</h2>
    ${lede ? `<p class="lede" style="margin-top:16px">${lede}</p>` : ''}
  </div>`
}

export function split({ id, art, words, flip = false, className = '' }) {
  return `<section${id ? ` id="${id}"` : ''} class="band ${className}">
    <div class="container">
      <div class="split ${flip ? 'flip' : ''}">
        <div class="reveal">${art}</div>
        <div class="reveal">${words}</div>
      </div>
    </div>
  </section>`
}

export function faq(items) {
  return `<div class="faq reveal">${items
    .map(([q, a]) => `<details><summary>${q}</summary><div class="answer">${a}</div></details>`)
    .join('')}</div>`
}

export function faqSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({
      '@type': 'Question',
      name: q.replace(/<[^>]+>/g, ''),
      acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') },
    })),
  }
}

/**
 * Tabbed features.
 *
 * Each panel carries the id the navigation points at, so a menu item can open
 * the site at the right tab instead of scrolling to a heading. With JavaScript
 * off the first panel is simply the one shown and every link still resolves.
 */
export function tabs(items, { frame } = {}) {
  const buttons = items
    .map(
      (item, i) =>
        `<button class="tab" role="tab" aria-selected="${i === 0}" aria-controls="${item.id}" id="tab-${item.id}"${item.screen ? ` data-screen-go="${item.screen}"` : ''}>${item.label}</button>`
    )
    .join('')
  const panels = items
    .map(
      (item, i) => `<div class="panel" role="tabpanel" id="${item.id}" aria-labelledby="tab-${item.id}"${i === 0 ? ' data-active' : ''}>
        <h3>${item.title}</h3><p class="lede" style="margin-top:12px">${item.copy}</p>
      </div>`
    )
    .join('')

  // The tab row runs the full width above the split rather than inside the left
  // column, where six pills wrapped onto two rows and left a hole above them.
  // Tab and frame move together: pick one and the demo opens that screen, so
  // the copy and the thing it describes are never out of step.
  return `<div class="reveal">
    <div class="tabs" role="tablist"${frame ? ` data-frame="${frame}"` : ''}>${buttons}</div>
    <div class="split split-tab">
      <div>${panels}</div>
      <div>${frame ? demoApp({ id: frame, start: items[0].screen ?? 'home' }) : ''}</div>
    </div>
  </div>`
}

/**
 * The three ways in, side by side.
 *
 * One trial button forces everybody down the same path, including the creator
 * who has already decided and would rather just pay. Three buttons let each of
 * them self select: subscribe, read what is in it, or try it first.
 */
export function planCta({ subscribe, trial, included = '#included', size = '' } = {}) {
  return `<div class="plan-cta">
    <a class="btn ${size}" href="${subscribe}">Subscribe</a>
    <a class="btn btn-ghost ${size}" href="${included}">What is included</a>
    <a class="btn btn-trial ${size}" href="${trial}">14 day trial</a>
  </div>`
}

/**
 * The plan card: pick a term, see one price.
 *
 * Five rows of a table asked the reader to do the comparison themselves. A
 * selector answers the only question they have, which is what it costs for the
 * length they are thinking of, and states the renewal price in the same breath
 * so the number is never a surprise later.
 */
export function planCard({ pricing, inr, subscribe, trial, compact = false }) {
  const terms = pricing.terms
    .map(
      (term, i) => `<button class="term-pill" data-term="${i}" aria-pressed="${term.key === 'yearly'}">
        ${term.label}${term.key === 'yearly' ? `<span class="save">Save ${pricing.yearlyDiscount}%</span>` : ''}
      </button>`
    )
    .join('')

  const data = pricing.terms.map((term) => ({
    label: term.label,
    months: term.months,
    total: inr(term.intro),
    list: inr(term.list),
    perMonth: inr(term.perMonth),
    withGst: inr(Math.round(term.intro * (1 + pricing.gstPercent / 100))),
    save: Math.round(((term.list - term.intro) / term.list) * 100),
  }))

  return `<div class="price-card" data-plan='${JSON.stringify(data).replace(/'/g, '&#39;')}'>
    <div class="offer-chip" data-intro-chip hidden>Launch offer, ${pricing.introPercent}% off</div>
    <div class="term-pills">${terms}</div>
    <div class="price-line">
      <span class="price-now figure" data-plan-total>-</span>
      <span class="price-was figure strike" data-plan-list>-</span>
      <span class="save-badge" data-plan-save></span>
    </div>
    <p class="dim" style="font-size:16px"><b data-plan-permonth></b> a month, <span data-plan-gst></span> with ${pricing.gstPercent}% GST</p>
    <p class="fine" data-plan-renew style="margin-top:6px"></p>
    ${planCta({ subscribe, trial })}
    ${compact ? '' : `<p class="fine" style="margin-top:14px">Card, UPI or netbanking.</p>`}
  </div>`
}

export function closingCta({ title, sub, primary = 'Start free', href, secondary }) {
  return `<section class="close-cta">
    <div class="container reveal">
      <h2 style="max-width:16ch;margin:0 auto">${title}</h2>
      <p class="lede" style="margin:18px auto 0;max-width:52ch">${sub}</p>
      <div class="btn-row">
        <a class="btn btn-lg" href="${href}">${primary}</a>
        ${secondary ? `<a class="btn btn-lg btn-ghost" href="${secondary[1]}">${secondary[0]}</a>` : ''}
      </div>
    </div>
  </section>`
}

/* ── the drawings ──────────────────────────────────────────────────────── */

const chipClass = { blue: 'chip-blue', green: 'chip-green', amber: 'chip-amber', rose: 'chip-rose' }

function bavatar(d) {
  return `<div class="bavatar" style="background:${d.tint}">${d.initials}</div>`
}


/* ── the demo, which actually works ──────────────────────────────────────── */
/*
 * Every screen below is in the page at once and one is shown at a time. The
 * rail navigates, the quick actions open, a deal row opens that deal, and a
 * back arrow returns. Nothing leaves the frame and nothing is submitted: this
 * is a product you can walk through before signing up, not a live account.
 *
 * Still drawn rather than screenshotted, for the same two reasons as before:
 * the app's interface is not finished, and no real workspace belongs on a
 * public page.
 */

const railItems = [
  ['home', 'chart', 'Home'],
  ['deals', 'bolt', 'Deals'],
  ['money', 'wallet', 'Money'],
  ['team', 'users', 'Team'],
  ['invoice', 'doc', 'Invoices'],
]

const backBar = (title, note = '') =>
  `<div class="app-head">
    <div style="display:flex;align-items:center;gap:10px">
      <button class="app-back" data-go="home" aria-label="Back">${icon('back', { size: 15 })}</button>
      <div><div class="app-hi" style="font-size:15px">${title}</div>${note ? `<div class="app-date">${note}</div>` : ''}</div>
    </div>
  </div>`

const dealRow = (d, i) => `<button class="list-row" data-go="deal" data-deal="${i}">
  ${bavatar(d)}
  <div style="text-align:left"><div class="t">${d.name}</div><div class="m">${d.work} · ${d.state}</div></div>
  <div class="r"><div class="amt">${d.amount}</div><span class="chip ${chipClass[d.chip[1]]}" style="margin-top:3px">${d.chip[0]}</span></div>
</button>`

const screenHome = () => `
  <div class="app-head">
    <div><div class="app-date">${TODAY}</div><div class="app-hi">Morning, ${CREATOR.name.split(' ')[0]}</div></div>
    <div class="app-avatar">${CREATOR.initials}</div>
  </div>
  <div class="stat-row">
    <button class="stat stat-hero" data-go="money"><div class="k">Owed to you</div><div class="v">${MONEY.owed}</div><div class="s">${MONEY.owedNote}</div></button>
    <button class="stat" data-go="money"><div class="k">Received</div><div class="v">${MONEY.received}</div><div class="s">This month</div></button>
    <button class="stat" data-go="deals"><div class="k">Live deals</div><div class="v">${MONEY.live}</div><div class="s">In progress</div></button>
  </div>
  <div class="act-row">
    <button class="act" data-go="newdeal"><span>${icon('camera', { size: 15 })}</span> New deal</button>
    <button class="act" data-go="invoice"><span>${icon('doc', { size: 15 })}</span> Raise invoice</button>
    <button class="act" data-go="tax"><span>${icon('chart', { size: 15 })}</span> Year in review</button>
  </div>
  <div class="list">
    <div class="list-head">Needs you today</div>
    ${DEALS.map(dealRow).join('')}
  </div>`

const screenDeals = () => `
  ${backBar('All deals', `${DEALS.length} of ${MONEY.live}`)}
  <div class="chip-row"><span class="chip chip-blue">All</span><span class="chip">Live</span><span class="chip">Unpaid</span><span class="chip">Paid</span></div>
  <div class="list">${DEALS.map(dealRow).join('')}</div>`

const screenDeal = () => `
  ${backBar('Deal', 'Skincare campaign')}
  <div class="ui-row">
    <div class="bavatar" data-deal-avatar style="background:${DEALS[0].tint}">${DEALS[0].initials}</div>
    <div><div class="ui-label" data-deal-name>${DEALS[0].name}</div><div class="ui-meta" data-deal-work>${DEALS[0].work}</div></div>
    <span class="ui-label" data-deal-amount>${DEALS[0].amount}</span>
  </div>
  <div class="track" style="padding:8px 4px 4px">
    <div class="track-step done"><div class="track-dot">${icon('check', { size: 12, stroke: 2.6 })}</div><span>Script</span></div>
    <div class="track-step done"><div class="track-dot">${icon('check', { size: 12, stroke: 2.6 })}</div><span>Shoot</span></div>
    <div class="track-step now"><div class="track-dot"></div><span>Edit</span></div>
    <div class="track-step"><div class="track-dot"></div><span>Publish</span></div>
  </div>
  <div class="ui-row">
    <div class="ui-avatar" style="background:#0F9D63">${icon('check', { size: 16 })}</div>
    <div><div class="ui-label">Advance, 50%</div><div class="ui-meta">Received on signing</div></div>
    <span class="ui-label">₹22,500</span>
  </div>
  <div class="ui-row">
    <div class="ui-avatar" style="background:#E08A17">${icon('wallet', { size: 16 })}</div>
    <div><div class="ui-label">Balance, 50%</div><div class="ui-meta">Due 30 days after publish</div></div>
    <span class="ui-label">₹22,500</span>
  </div>
  <div class="act-row" style="grid-template-columns:1fr 1fr">
    <button class="act" data-go="invoice"><span>${icon('doc', { size: 15 })}</span> Raise invoice</button>
    <button class="act" data-go="money"><span>${icon('wallet', { size: 15 })}</span> Chase payment</button>
  </div>`

const screenMoney = () => {
  const bars = [38, 62, 44, 78, 56, 92]
  return `
  ${backBar('Money', 'Last six months')}
  <div class="stat-row" style="grid-template-columns:1fr 1fr">
    <div class="stat stat-hero"><div class="k">Still out</div><div class="v">${MONEY.owed}</div><div class="s">${MONEY.owedNote}</div></div>
    <div class="stat"><div class="k">Collected</div><div class="v">${MONEY.collection}</div><div class="s">Of everything invoiced</div></div>
  </div>
  <div class="bars">${bars.map((h, i) => `<div class="bar ${i === bars.length - 1 ? 'on' : ''}" style="height:${h}%"></div>`).join('')}</div>
  <div class="list">${DEALS.slice(1).map(dealRow).join('')}</div>`
}

const screenNewDeal = () => {
  const d = DEALS[2]
  return `
  ${backBar('New deal', 'about 30 seconds')}
  <div class="chip-row">
    ${[
      ['screenshot', 'camera', 'Screenshot'],
      ['voice', 'mic', 'Voice'],
      ['type', 'keyboard', 'Type'],
      ['repeat', 'refresh', 'Repeat'],
    ]
      .map(
        ([mode, glyph, label], i) =>
          `<button class="chip${i === 0 ? ' chip-blue' : ''}" data-mode="${mode}">${icon(glyph, { size: 13 })} ${label}</button>`
      )
      .join('')}
  </div>
  <div class="ui-row">
    ${bavatar(d)}
    <div><div class="ui-label">${d.name}</div><div class="ui-meta" data-source>Read from the screenshot</div></div>
    <span class="chip chip-green" data-found>Found</span>
  </div>
  <div class="ui-row" style="grid-template-columns:1fr">
    <div><div class="ui-meta">Deliverables</div><div class="chip-row" style="margin-top:8px"><span class="chip chip-blue">1 Feed post</span><span class="chip chip-blue">2 Stories</span></div></div>
  </div>
  <div class="ui-row" style="grid-template-columns:1fr auto">
    <div><div class="ui-meta">Rate</div><div class="ui-label" style="margin-top:2px">₹28,000</div></div>
    <span class="chip">Check before saving</span>
  </div>
  <button class="act" data-go="deal" style="justify-content:center"><span>${icon('check', { size: 15 })}</span> Save the deal</button>`
}

const screenInvoice = () => `
  ${backBar('Invoice', INVOICE.number)}
  <div style="display:grid;gap:10px">
    ${uiInvoice()}
    <button class="act" data-go="money" style="justify-content:center"><span>${icon('phone', { size: 15 })}</span> Send on WhatsApp</button>
  </div>`

const screenTax = () => {
  const dates = [['15 Jun', '₹54,000'], ['15 Sep', '₹1,08,000'], ['15 Dec', '₹1,08,000'], ['15 Mar', '₹90,000']]
  return `
  ${backBar('Year in review', 'April to March')}
  <div class="stat stat-hero"><div class="k">Advance tax expected</div><div class="v">₹3,60,000</div><div class="s">From your income, less your expenses</div></div>
  <div class="cal">${dates.map(([d, amt], i) => `<div class="${i === 1 ? 'soon' : ''}"><b>${d}</b><span>${amt}</span></div>`).join('')}</div>
  <button class="act" data-go="ratecard" style="justify-content:center"><span>${icon('users', { size: 15 })}</span> Open your rate card</button>`
}

const screenTeam = () => {
  const areas = [['Deals and deadlines', true], ['Brands and contacts', true], ['Invoices', true], ['Rates', false], ['Bank details', false]]
  return `
  ${backBar('Invite a manager', 'You choose what they see')}
  ${areas.map(([label, on]) => `<div class="ui-row" style="grid-template-columns:1fr auto;padding:11px 12px">
    <span class="ui-label">${label}</span><span class="chip ${on ? 'chip-green' : ''}">${on ? 'Visible' : 'Hidden'}</span>
  </div>`).join('')}
  <div class="ui-row" style="grid-template-columns:auto 1fr;background:var(--rose-soft)">
    ${icon('shield', { size: 17 })}
    <span class="ui-label" style="color:var(--rose)">Nobody but you can delete anything</span>
  </div>`
}

const screenRateCard = () => `
  ${backBar('Rate card', 'Ready to send')}
  ${uiRateCard()}`

const SCREENS = {
  home: screenHome,
  deals: screenDeals,
  deal: screenDeal,
  money: screenMoney,
  newdeal: screenNewDeal,
  invoice: screenInvoice,
  tax: screenTax,
  team: screenTeam,
  ratecard: screenRateCard,
}

/** The whole thing, walkable. `id` scopes it so two can sit on one page. */
export function demoApp({ id = 'demo', start = 'home' } = {}) {
  const rail = railItems
    .map(
      ([screen, glyph, label]) =>
        `<button class="rail-btn${screen === start ? ' on' : ''}" data-go="${screen}" aria-label="${label}" title="${label}">${icon(glyph, { size: 17 })}</button>`
    )
    .join('')

  const screens = Object.entries(SCREENS)
    .map(([name, render]) => `<div class="app-body" data-screen="${name}"${name === start ? '' : ' hidden'}>${render()}</div>`)
    .join('')

  return `<div class="app" data-demo="${id}">
    <div class="app-rail">${rail}</div>
    <div class="app-screens">${screens}</div>
    <div class="demo-hint">Have a click around. Nothing here leaves the page.</div>
  </div>`
}

/** The dashboard, static, for places that only need to show it. */
export function uiDashboard() {
  return `<div class="app">
    <div class="app-rail">
      <i class="on">${icon('chart', { size: 17 })}</i>
      <i>${icon('bolt', { size: 17 })}</i>
      <i>${icon('wallet', { size: 17 })}</i>
      <i>${icon('users', { size: 17 })}</i>
      <i>${icon('doc', { size: 17 })}</i>
    </div>
    <div class="app-body">
      <div class="app-head">
        <div>
          <div class="app-date">${TODAY}</div>
          <div class="app-hi">Morning, ${CREATOR.name.split(' ')[0]}</div>
        </div>
        <div class="app-avatar">${CREATOR.initials}</div>
      </div>

      <div class="stat-row">
        <div class="stat stat-hero"><div class="k">Owed to you</div><div class="v">${MONEY.owed}</div><div class="s">${MONEY.owedNote}</div></div>
        <div class="stat"><div class="k">Received</div><div class="v">${MONEY.received}</div><div class="s">This month</div></div>
        <div class="stat"><div class="k">Live deals</div><div class="v">${MONEY.live}</div><div class="s">In progress</div></div>
      </div>

      <div class="act-row">
        <div class="act"><span>${icon('camera', { size: 15 })}</span> New deal</div>
        <div class="act"><span>${icon('doc', { size: 15 })}</span> Raise invoice</div>
        <div class="act"><span>${icon('chart', { size: 15 })}</span> Year in review</div>
      </div>

      <div class="list">
        <div class="list-head">Needs you today</div>
        ${DEALS.map(
          (d) => `<div class="list-row">
          ${bavatar(d)}
          <div><div class="t">${d.name}</div><div class="m">${d.work} · ${d.state}</div></div>
          <div class="r"><div class="amt">${d.amount}</div><span class="chip ${chipClass[d.chip[1]]}" style="margin-top:3px">${d.chip[0]}</span></div>
        </div>`
        ).join('')}
      </div>
    </div>
  </div>`
}

/** One deal, and the stages its creator named herself. */
export function uiDeal() {
  const d = DEALS[0]
  return `<div class="ui" style="max-width:420px">
    <div class="ui-top"><span class="ui-title">Deal</span><span class="chip chip-blue">Live</span></div>
    <div class="ui-row">
      ${bavatar(d)}
      <div><div class="ui-label">${d.name}</div><div class="ui-meta">${d.work}</div></div>
      <span class="ui-label">${d.amount}</span>
    </div>
    <div class="track" style="padding:6px 4px 2px">
      <div class="track-step done"><div class="track-dot">${icon('check', { size: 12, stroke: 2.6 })}</div><span>Script</span></div>
      <div class="track-step done"><div class="track-dot">${icon('check', { size: 12, stroke: 2.6 })}</div><span>Shoot</span></div>
      <div class="track-step now"><div class="track-dot"></div><span>Edit</span></div>
      <div class="track-step"><div class="track-dot"></div><span>Publish</span></div>
    </div>
    <div class="ui-row">
      <div class="ui-avatar" style="background:var(--green)">${icon('check', { size: 16 })}</div>
      <div><div class="ui-label">Advance, 50%</div><div class="ui-meta">Received on signing</div></div>
      <span class="ui-label">₹22,500</span>
    </div>
    <div class="ui-row">
      <div class="ui-avatar" style="background:#E08A17">${icon('wallet', { size: 16 })}</div>
      <div><div class="ui-label">Balance, 50%</div><div class="ui-meta">Due 30 days after publish</div></div>
      <span class="ui-label">₹22,500</span>
    </div>
  </div>`
}

/** Four ways a deal gets in. */
export function uiCapture() {
  const d = DEALS[2]
  return `<div class="ui" style="max-width:400px">
    <div class="ui-top"><span class="ui-title">New deal</span><span class="ui-sub">about 30 seconds</span></div>
    <div class="chip-row">
      <span class="chip chip-blue">${icon('camera', { size: 13 })} Screenshot</span>
      <span class="chip">${icon('mic', { size: 13 })} Voice</span>
      <span class="chip">${icon('keyboard', { size: 13 })} Type</span>
      <span class="chip">${icon('refresh', { size: 13 })} Repeat</span>
    </div>
    <div class="ui-row">
      ${bavatar(d)}
      <div><div class="ui-label">${d.name}</div><div class="ui-meta">Read from the screenshot</div></div>
      <span class="chip chip-green">Found</span>
    </div>
    <div class="ui-row" style="grid-template-columns:1fr">
      <div>
        <div class="ui-meta">Deliverables</div>
        <div class="chip-row" style="margin-top:8px"><span class="chip chip-blue">1 Feed post</span><span class="chip chip-blue">2 Stories</span></div>
      </div>
    </div>
    <div class="ui-row" style="grid-template-columns:1fr auto">
      <div><div class="ui-meta">Rate</div><div class="ui-label" style="margin-top:2px">₹28,000</div></div>
      <span class="chip">Check before saving</span>
    </div>
  </div>`
}

/** What reaches the phone. No amount, ever, which is the product's own rule. */
export function uiReminders({ count = 4, width = '400px' } = {}) {
  const colors = { accent: 'var(--accent)', rose: 'var(--rose)', green: 'var(--green)' }
  return `<div style="display:grid;gap:12px;max-width:${width}">${REMINDERS.slice(0, count)
    .map(
      ([glyph, tone, title, body]) => `<div class="note">
      <div class="n-icon" style="background:${colors[tone]}">${icon(glyph, { size: 15 })}</div>
      <div><div class="n-title">${title}</div><div class="n-body">${body}</div></div>
    </div>`
    )
    .join('')}</div>`
}

/** Money in, money owed, and who is late. */
export function uiMoney() {
  const bars = [38, 62, 44, 78, 56, 92]
  return `<div class="ui" style="max-width:420px">
    <div class="ui-top"><span class="ui-title">Money</span><span class="ui-sub">Last six months</span></div>
    <div class="stat-row" style="grid-template-columns:1fr 1fr">
      <div class="stat stat-hero"><div class="k">Still out</div><div class="v">${MONEY.owed}</div><div class="s">${MONEY.owedNote}</div></div>
      <div class="stat"><div class="k">Collected</div><div class="v">${MONEY.collection}</div><div class="s">Of everything invoiced</div></div>
    </div>
    <div class="bars">${bars.map((h, i) => `<div class="bar ${i === bars.length - 1 ? 'on' : ''}" style="height:${h}%"></div>`).join('')}</div>
    ${DEALS.slice(1, 4)
      .map(
        (d) => `<div class="ui-row">
      ${bavatar(d)}
      <div><div class="ui-label">${d.name}</div><div class="ui-meta">${d.state}</div></div>
      <span class="chip ${chipClass[d.chip[1]]}">${d.chip[0]}</span>
    </div>`
      )
      .join('')}
  </div>`
}

/** The invoice, at the fidelity a finance team would actually receive. */
export function uiInvoice() {
  return `<div class="paper" style="max-width:400px">
    <div class="p-head">
      <div>
        <div class="p-name">${CREATOR.name}</div>
        <div class="p-muted">${CREATOR.city}<br>GSTIN ${CREATOR.gstin}<br>PAN ${CREATOR.pan}</div>
      </div>
      <div><div class="p-kind">Tax invoice</div><div class="p-num">${INVOICE.number}</div><div class="p-muted">${INVOICE.date}</div></div>
    </div>
    <div class="p-rule"></div>
    <div>
      <div class="p-kind" style="text-align:left">Billed to</div>
      <div class="p-name" style="font-size:12.5px;margin-top:3px">${INVOICE.billedTo}</div>
      <div class="p-muted">GSTIN ${INVOICE.gstin}</div>
    </div>
    <table>
      <thead><tr><th style="text-align:left">Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody><tr><td>${INVOICE.line}<br><span style="color:#A29A92">SAC ${INVOICE.hsn}</span></td><td style="text-align:right">${INVOICE.amount}</td></tr></tbody>
    </table>
    <div>
      <div class="p-tot"><span>Subtotal</span><span>${INVOICE.amount}</span></div>
      <div class="p-tot"><span>IGST at 18%</span><span>${INVOICE.gst}</span></div>
      <div class="p-tot"><span>Less TDS withheld</span><span>${INVOICE.tds}</span></div>
      <div class="p-tot big"><span>Amount due</span><span>${INVOICE.due}</span></div>
    </div>
    <div class="p-rule"></div>
    <div class="p-head" style="align-items:flex-end">
      <div class="p-muted">Pay by UPI<br>${CREATOR.upi}<br>A/C ${CREATOR.account}<br>IFSC ${CREATOR.ifsc}</div>
      <div class="p-qr"></div>
    </div>
  </div>`
}

/** The card a creator sends when a brand asks for commercials. */
export function uiRateCard() {
  return `<div class="ratecard" style="max-width:340px">
    <div class="rc-top">
      <div class="rc-face" style="display:grid;place-items:center;font-weight:600;font-size:15px">${CREATOR.initials}</div>
      <div>
        <div style="font-size:16px;font-weight:600;letter-spacing:-.02em">${CREATOR.name}</div>
        <div style="font-size:12px;opacity:.78">${CREATOR.niche} · ${CREATOR.followers} followers</div>
      </div>
    </div>
    <div>
      ${RATES.map(
        ([label, amount, pct]) => `<div class="rc-row"><span>${label}</span><span style="display:flex;align-items:center;gap:10px"><span class="rc-bar"><i style="width:${pct}%"></i></span><b style="font-variant-numeric:tabular-nums">${amount}</b></span></div>`
      ).join('')}
    </div>
    <div style="font-size:11px;opacity:.78">Every rate is the median of what you have actually charged</div>
  </div>`
}

/** The four dates section 211 sets. */
export function uiTaxCalendar() {
  const dates = [['15 Jun', '₹54,000'], ['15 Sep', '₹1,08,000'], ['15 Dec', '₹1,08,000'], ['15 Mar', '₹90,000']]
  return `<div class="ui" style="max-width:420px">
    <div class="ui-top"><span class="ui-title">Advance tax</span><span class="ui-sub">Section 211</span></div>
    <div class="stat" style="background:var(--accent);color:#fff">
      <div class="k" style="color:rgba(255,255,255,.76)">Expected for the year</div>
      <div class="v" style="font-size:26px">₹3,60,000</div>
      <div class="s" style="color:rgba(255,255,255,.76)">From your income, less your expenses</div>
    </div>
    <div class="cal">
      ${dates.map(([d, amt], i) => `<div class="${i === 1 ? 'soon' : ''}"><b>${d}</b><span>${amt}</span></div>`).join('')}
    </div>
  </div>`
}

/** What a manager can and cannot see. */
export function uiTeam() {
  const areas = [['Deals and deadlines', true], ['Brands and contacts', true], ['Invoices', true], ['Rates', false], ['Bank details', false]]
  return `<div class="ui" style="max-width:390px">
    <div class="ui-top"><span class="ui-title">Invite a manager</span><span class="chip">${icon('users', { size: 12 })} Team</span></div>
    ${areas
      .map(
        ([label, on]) => `<div class="ui-row" style="grid-template-columns:1fr auto;padding:11px 12px">
      <span class="ui-label">${label}</span>
      <span class="chip ${on ? 'chip-green' : ''}">${on ? 'Visible' : 'Hidden'}</span>
    </div>`
      )
      .join('')}
    <div class="ui-row" style="grid-template-columns:auto 1fr;background:var(--rose-soft)">
      ${icon('shield', { size: 17 })}
      <span class="ui-label" style="color:var(--rose)">Nobody but you can delete anything</span>
    </div>
  </div>`
}
