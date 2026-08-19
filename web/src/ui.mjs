// Section builders, and the drawings that stand in for screenshots.
//
// Nothing on this site is a photograph of a real workspace. The app's interface
// is not finished, so a screenshot would date the site every time a screen
// moves; and a screenshot of a working account carries a creator's business on
// it, which is not ours to publish. These draw the shape of the product
// instead: no names, no brands, no account numbers, no rupee figures. Where a
// quantity matters, it is a proportion.

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

const AV = { blue: '#3B6EF6', violet: '#7C5CF0', green: '#0F9D63', amber: '#E08A17', rose: '#E2557A' }

function avatar(color, glyph) {
  return `<div class="ui-avatar" style="background:${color}">${icon(glyph, { size: 17 })}</div>`
}

/** Four ways a deal gets in, and the form it lands on. */
export function uiCapture() {
  return `<div class="ui" style="max-width:400px">
    <div class="ui-top"><span class="ui-title">New deal</span><span class="ui-sub">about 30 seconds</span></div>
    <div class="chip-row">
      <span class="chip chip-blue">${icon('camera', { size: 13 })} Screenshot</span>
      <span class="chip">${icon('mic', { size: 13 })} Voice</span>
      <span class="chip">${icon('keyboard', { size: 13 })} Type</span>
      <span class="chip">${icon('refresh', { size: 13 })} Repeat</span>
    </div>
    <div class="ui-row" style="grid-template-columns:1fr">
      <div>
        <div class="ui-meta">Deliverables</div>
        <div class="chip-row" style="margin-top:8px">
          <span class="chip chip-blue">Reel</span><span class="chip">Story</span>
          <span class="chip">Carousel</span><span class="chip">Short</span><span class="chip">Video</span>
        </div>
      </div>
    </div>
    <div class="ui-row" style="grid-template-columns:1fr">
      <div>
        <div class="ui-meta">Payment terms</div>
        <div class="chip-row" style="margin-top:8px">
          <span class="chip chip-blue">50% advance</span><span class="chip chip-blue">50% on delivery</span>
        </div>
      </div>
    </div>
  </div>`
}

/** A deal moving through stages the creator named herself. */
export function uiDeal() {
  return `<div class="ui" style="max-width:430px">
    <div class="ui-top"><span class="ui-title">Deal</span><span class="chip chip-blue">Live</span></div>
    <div class="ui-row">
      ${avatar(AV.violet, 'bolt')}
      <div><div class="ui-label">Reel and 3 Stories</div><div class="ui-meta">Skincare brand</div></div>
      <span class="chip chip-green">On track</span>
    </div>
    <div class="track" style="padding:6px 4px 2px">
      <div class="track-step done"><div class="track-dot">${icon('check', { size: 12, stroke: 2.6 })}</div><span>Script</span></div>
      <div class="track-step done"><div class="track-dot">${icon('check', { size: 12, stroke: 2.6 })}</div><span>Shoot</span></div>
      <div class="track-step now"><div class="track-dot"></div><span>Edit</span></div>
      <div class="track-step"><div class="track-dot"></div><span>Publish</span></div>
    </div>
    <div class="ui-row">
      ${avatar(AV.green, 'wallet')}
      <div><div class="ui-label">Advance</div><div class="ui-meta">Received</div></div>
      <span class="chip chip-green">Paid</span>
    </div>
    <div class="ui-row">
      ${avatar(AV.amber, 'wallet')}
      <div><div class="ui-label">Balance</div><div class="ui-meta">Due after publish</div></div>
      <span class="chip chip-amber">Scheduled</span>
    </div>
  </div>`
}

/** What actually reaches the phone. No amount, ever, which is the product's own rule. */
export function uiReminders({ count = 4, width = '400px' } = {}) {
  const notes = [
    ['bell', 'var(--accent)', 'Shoot is due tomorrow', 'Skincare brand'],
    ['wallet', 'var(--rose)', 'A payment is overdue', 'Tap to send a follow up'],
    ['calendar', 'var(--green)', 'Advance tax due 15 September', 'Set aside before the date'],
    ['refresh', 'var(--accent)', 'Saved without signal', 'It will sync on its own'],
  ]
  return `<div style="display:grid;gap:12px;max-width:${width}">${notes
    .slice(0, count)
    .map(
      ([glyph, color, title, body]) => `<div class="note">
      <div class="n-icon" style="background:${color}">${icon(glyph, { size: 15 })}</div>
      <div><div class="n-title">${title}</div><div class="n-body">${body}</div></div>
    </div>`
    )
    .join('')}</div>`
}

/** Money, as proportions. Nobody's earnings appear on this page. */
export function uiMoney() {
  const bars = [38, 62, 44, 78, 56, 92]
  return `<div class="ui" style="max-width:420px">
    <div class="ui-top"><span class="ui-title">Money</span><span class="ui-sub">Last six months</span></div>
    <div class="bars">${bars.map((h, i) => `<div class="bar ${i === bars.length - 1 ? 'on' : ''}" style="height:${h}%"></div>`).join('')}</div>
    <div class="bar-legend"><span>Received</span><span>Still out</span></div>
    <div class="ui-row">
      ${avatar(AV.green, 'check')}
      <div><div class="ui-label">Paid</div><div class="ui-meta">Settled and reconciled</div></div>
      <span class="chip chip-green">Closed</span>
    </div>
    <div class="ui-row">
      ${avatar(AV.amber, 'wallet')}
      <div><div class="ui-label">Due soon</div><div class="ui-meta">Terms agreed on the deal</div></div>
      <span class="chip chip-amber">Waiting</span>
    </div>
    <div class="ui-row">
      ${avatar(AV.rose, 'bell')}
      <div><div class="ui-label">Overdue</div><div class="ui-meta">Follow up ready to send</div></div>
      <span class="chip chip-rose">Chase</span>
    </div>
  </div>`
}

/** The invoice, as a document rather than as anyone's data. */
export function uiInvoice() {
  return `<div class="doc" style="max-width:380px">
    <div class="doc-split">
      <div style="display:grid;gap:7px;flex:1">
        <div class="doc-line w55"></div><div class="doc-line w40" style="height:7px"></div>
      </div>
      <span class="chip chip-blue">Tax invoice</span>
    </div>
    <div class="doc-rule"></div>
    <div style="display:grid;gap:9px">
      <div class="doc-line w70"></div><div class="doc-line w55"></div><div class="doc-line w25"></div>
    </div>
    <div class="doc-rule"></div>
    <div class="chip-row"><span class="chip">CGST</span><span class="chip">SGST</span><span class="chip chip-blue">or IGST</span><span class="chip">TDS</span></div>
    <div class="doc-split" style="align-items:flex-end">
      <div style="display:grid;gap:8px;flex:1"><div class="doc-line w40"></div><div class="doc-line w55"></div></div>
      <div class="doc-qr" title="UPI"></div>
    </div>
    <div class="btn btn-sm" style="width:100%;pointer-events:none">Send on WhatsApp</div>
  </div>`
}

/** The card a creator sends when a brand asks for commercials. */
export function uiRateCard() {
  const rows = [['Reel', 84], ['Story', 38], ['Carousel', 56], ['Short', 62], ['Integration', 96]]
  return `<div class="ratecard" style="max-width:340px">
    <div class="rc-top">
      <div class="rc-face"></div>
      <div style="display:grid;gap:7px;flex:1"><div class="rc-line" style="width:62%"></div><div class="rc-line" style="width:40%;opacity:.7"></div></div>
    </div>
    <div>
      ${rows.map(([label, pct]) => `<div class="rc-row"><span>${label}</span><span class="rc-bar"><i style="width:${pct}%"></i></span></div>`).join('')}
    </div>
    <div style="font-size:11.5px;opacity:.78">Every rate is the median of what you have actually charged</div>
  </div>`
}

/** The four dates section 211 sets. Public facts, so this is the one calendar the site can honestly draw. */
export function uiTaxCalendar() {
  const dates = [['15 Jun', '15%'], ['15 Sep', '45%'], ['15 Dec', '75%'], ['15 Mar', '100%']]
  return `<div class="ui" style="max-width:420px">
    <div class="ui-top"><span class="ui-title">Advance tax</span><span class="ui-sub">Section 211</span></div>
    <div class="cal">
      ${dates.map(([d, pct], i) => `<div class="${i === 1 ? 'soon' : ''}"><b>${d}</b><span>${pct} cumulative</span></div>`).join('')}
    </div>
    <div class="ui-row">
      ${avatar(AV.blue, 'chart')}
      <div><div class="ui-label">Worked out from your own deals</div><div class="ui-meta">Income in, expenses off, you adjust the rest</div></div>
    </div>
  </div>`
}

/** Permission switches, which is what a manager or an agency is really asking about. */
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
