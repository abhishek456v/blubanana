// The free tools.
//
// Five calculators, no sign up, no email wall. They exist for two reasons: a
// creator searching "advance tax for content creator" in the week before
// 15 September has a real problem and no good answer, and a page that solves it
// in ten seconds earns more trust than any paragraph about trust.
//
// The arithmetic is imported from the app's own modules through
// web/browser/tools.ts, so the advance tax split here and the one inside
// Blubanana are the same function rather than two copies waiting to disagree.

import { PRICING, SITE, TOOLS } from '../site.mjs'
import { closingCta, head, icon, section } from '../ui.mjs'

/** The row of every tool, on every tool page. Moving between them should not
 *  require going back up to a menu. */
function toolNav(current) {
  return `<nav class="tool-nav reveal">${TOOLS.map(
    ([href, title]) =>
      `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${title.replace(' calculator', '')}</a>`
  ).join('')}</nav>`
}

/** Every tool page has the same bones, so a fix to one shape fixes five pages. */
function toolPage({ path, name, h1, line, description, form, out, how, related = 3, script }) {
  const others = TOOLS.filter(([href]) => href !== path).slice(0, related)

  const body = `
<section class="hero" style="padding-bottom:0">
  <div class="container">
    <div class="eyebrow reveal">Free tool, no sign up</div>
    <h1 class="reveal" style="max-width:18ch;font-size:clamp(30px,4vw,46px)">${h1}</h1>
    <p class="lede reveal" style="max-width:52ch;margin-top:18px">${line}</p>
    ${toolNav(path)}
  </div>
</section>

<section class="band" style="padding-top:56px">
  <div class="container">
    <div class="tool reveal">
      <div class="tool-form">${form}</div>
      <div class="tool-out" id="out">${out}</div>
    </div>
    <p class="tool-note reveal" style="margin-top:22px;max-width:640px">${how}</p>
  </div>
</section>

<section class="band band-alt">
  <div class="container">
    <div class="split">
      <div class="reveal">
        <h2>It does this from your real deals</h2>
        <p class="lede" style="margin-top:16px">Inside Blubanana the figures come from the work you have already logged, and it reminds you before the date rather than after.</p>
        <div class="btn-row" style="margin-top:24px">
          <a class="btn" href="${SITE.signup}">Start free for ${PRICING.trialDays} days</a>
        </div>
      </div>
      <div class="reveal">
        <h4 style="margin-bottom:14px">Other free tools</h4>
        <div class="grid" style="gap:12px">
          ${others.map(([href, title, note]) => `<a class="card" href="${href}"><h4>${title}</h4><p>${note}</p></a>`).join('')}
        </div>
      </div>
    </div>
  </div>
</section>`

  return {
    path,
    title: `${name} for Indian creators | Blubanana`,
    description,
    script,
    body: [
      body,
      closingCta({
        title: 'Stop working this out by hand',
        sub: `Blubanana keeps it up to date from the deals you log. ${PRICING.trialDays} days free, no card.`,
        href: SITE.signup,
      }),
    ].join('\n'),
  }
}

const field = (id, label, hint, input, presets) =>
  `<div class="field">
    <label for="${id}">${label}</label>
    ${input}
    ${presets ? `<div class="preset-row">${presets.map((v) => `<button type="button" class="preset" data-for="${id}" data-value="${v[1]}">${v[0]}</button>`).join('')}</div>` : ''}
    ${hint ? `<span class="hint">${hint}</span>` : ''}
  </div>`

const number = (id, value, extra = '') =>
  `<input id="${id}" type="number" inputmode="decimal" value="${value}" ${extra}>`

/** A rupee mark sitting inside the box, so the field reads as money at a glance. */
const money = (id, value, extra = '') =>
  `<div class="money-input"><span>₹</span>${number(id, value, extra)}</div>`

/* ── 1. advance tax ──────────────────────────────────────────────────────── */
const advanceTax = toolPage({
  path: '/tools/advance-tax-calculator',
  name: 'Advance tax calculator',
  h1: 'Advance tax calculator for creators',
  line: 'Four dates, and what is due by each. Miss them and the interest under sections 234B and 234C is charged whether or not anyone reminded you.',
  description:
    'Work out what to set aside for advance tax by 15 June, 15 September, 15 December and 15 March. Free, no sign up, built for Indian content creators.',
  form: `
    ${field('income', 'Expected income this year', 'After your expenses. Everything you earn, not only what came through brand deals.', money('income', 1200000, 'min="0" step="10000"'), [['5L', 500000], ['12L', 1200000], ['25L', 2500000], ['50L', 5000000]])}
    ${field('rate', 'Your effective tax rate', 'Ask your CA. Rates change most budgets, so this tool will not guess one for you.', number('rate', 30, 'min="0" max="60" step="1"'))}
    ${field('paid', 'Already paid or deducted', 'TDS the brands withheld counts here.', money('paid', 0, 'min="0" step="5000"'))}`,
  out: `
    <div><span class="fine">Tax expected for the year</span><div class="out-big figure" id="total">-</div></div>
    <div id="rows"></div>
    <p class="tool-note" id="note"></p>`,
  how: 'Section 211 sets the four dates and the cumulative percentages: 15% by 15 June, 45% by 15 September, 75% by 15 December and the balance by 15 March. This applies your own effective rate to your own figure, which is the only honest way to do it without knowing the rest of your income.',
  script: `
    const $ = (id) => document.getElementById(id)
    document.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => {
      const target = $(b.dataset.for)
      target.value = b.dataset.value
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }))
    function run() {
      const income = Number($('income').value) || 0
      const rate = Number($('rate').value) || 0
      const paid = Number($('paid').value) || 0
      const expected = CD.estimateTax(income, rate)
      const remaining = Math.max(expected - paid, 0)
      $('total').textContent = CD.inr(expected)
      const fy = CD.financialYearStart()
      const rows = CD.advanceTaxSchedule(remaining, fy)
      $('rows').innerHTML = rows.map((r) =>
        '<div class="out-row"><span>' + r.label + (r.isPast ? ' (passed)' : '') + '</span><b>' + CD.inr(r.thisInstalment) + '</b></div>'
      ).join('')
      $('note').textContent = paid > 0
        ? CD.inr(paid) + ' already paid has been taken off before splitting the rest.'
        : 'TDS the brands have already withheld counts towards this. Enter it above and the instalments come down.'
    }
    document.querySelectorAll('.tool-form input').forEach((i) => i.addEventListener('input', run))
    run()`,
})

/* ── 2. TDS ──────────────────────────────────────────────────────────────── */
const tdsTool = toolPage({
  path: '/tools/tds-calculator',
  name: 'TDS calculator',
  h1: 'They deducted TDS. What actually reaches your bank?',
  line: 'Four numbers matter on every brand deal and only one of them is what you get. This shows all four.',
  description:
    'Work out GST, invoice total, TDS withheld and what actually lands in your account on a brand deal. Free TDS calculator for Indian content creators.',
  form: `
    ${field('base', 'Deal amount', 'What you agreed with the brand, before any tax.', money('base', 100000, 'min="0" step="1000"'), [['25K', 25000], ['50K', 50000], ['1L', 100000], ['3L', 300000]])}
    ${field('gst', 'GST you charge', 'Zero if you are not registered for GST.', `<select id="gst"><option value="18">18%</option><option value="0">Not registered</option></select>`)}
    ${field('tdsrate', 'TDS rate the brand deducts', 'Usually 10% for professional services under section 194J. Ask the brand which section they are deducting under.', `<select id="tdsrate"><option value="10">10%, section 194J</option><option value="2">2%, section 194C</option><option value="5">5%, section 194H</option><option value="1">1%</option></select>`)}`,
  out: `
    <div><span class="fine">Lands in your bank</span><div class="out-big figure" id="net">-</div></div>
    <div class="out-row"><span>Deal amount</span><b id="r-base">-</b></div>
    <div class="out-row"><span>GST added</span><b id="r-gst">-</b></div>
    <div class="out-row"><span>Invoice total</span><b id="r-total">-</b></div>
    <div class="out-row"><span>TDS withheld</span><b id="r-tds">-</b></div>
    <p class="tool-note">TDS is not lost. It sits against your PAN and you claim it when you file.</p>`,
  how: 'TDS is deducted on the value of the service, never on the GST charged on top of it. Getting that the wrong way round is the usual reason a creator’s arithmetic disagrees with the brand’s remittance advice, by exactly the tax on the tax.',
  script: `
    const $ = (id) => document.getElementById(id)
    document.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => {
      const target = $(b.dataset.for)
      target.value = b.dataset.value
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }))
    function run() {
      const base = Number($('base').value) || 0
      const gst = Number($('gst').value) || 0
      const rate = Number($('tdsrate').value) || 0
      const r = CD.tds(base, rate, gst)
      $('net').textContent = CD.inr(r.received)
      $('r-base').textContent = CD.inr(base)
      $('r-gst').textContent = CD.inr(r.gst)
      $('r-total').textContent = CD.inr(r.invoiceTotal)
      $('r-tds').textContent = CD.inr(r.withheld)
    }
    document.querySelectorAll('.tool-form input, .tool-form select').forEach((i) => i.addEventListener('input', run))
    run()`,
})

/* ── 3. GST ──────────────────────────────────────────────────────────────── */
const gstTool = toolPage({
  path: '/tools/gst-calculator',
  name: 'GST calculator',
  h1: 'CGST and SGST, or IGST?',
  line: 'It depends on two states, and getting it wrong is why a finance team sends the invoice back.',
  description:
    'Work out whether your invoice carries CGST and SGST or IGST, and how much of each. Free GST calculator for Indian creators and freelancers.',
  form: `
    ${field('amount', 'Invoice amount', 'Before tax.', money('amount', 100000, 'min="0" step="1000"'), [['25K', 25000], ['50K', 50000], ['1L', 100000], ['3L', 300000]])}
    ${field('rate2', 'GST rate', 'Creator and influencer services are usually 18%.', `<select id="rate2"><option value="18">18%</option><option value="5">5%</option><option value="12">12%</option><option value="28">28%</option></select>`)}
    ${field('mine', 'Your state', 'Where you are registered.', `<select id="mine"></select>`)}
    ${field('theirs', 'The brand’s state', 'The place of supply for a registered recipient is their registered address.', `<select id="theirs"></select>`)}`,
  out: `
    <div><span class="fine">Invoice total</span><div class="out-big figure" id="g-total">-</div></div>
    <div id="g-rows"></div>
    <p class="tool-note" id="g-note"></p>`,
  how: 'Under the IGST Act a supply is inter State when the supplier’s state and the place of supply differ, and intra State when they match. That single comparison decides whether the invoice carries IGST at the full rate or CGST and SGST at half each.',
  script: `
    const $ = (id) => document.getElementById(id)
    document.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => {
      const target = $(b.dataset.for)
      target.value = b.dataset.value
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }))
    const options = CD.GST_STATE_OPTIONS.map((o) => '<option value="' + o.code + '">' + o.name + '</option>').join('')
    $('mine').innerHTML = options
    $('theirs').innerHTML = options
    $('mine').value = '29'
    $('theirs').value = '27'
    function run() {
      const amount = Number($('amount').value) || 0
      const rate = Number($('rate2').value) || 0
      const tax = Math.round((amount * rate) / 100)
      const split = CD.splitGst(tax, $('mine').value, $('theirs').value)
      $('g-total').textContent = CD.inr(amount + tax)
      $('g-rows').innerHTML = split.interState
        ? '<div class="out-row"><span>Taxable value</span><b>' + CD.inr(amount) + '</b></div>' +
          '<div class="out-row"><span>IGST at ' + rate + '%</span><b>' + CD.inr(split.igst) + '</b></div>'
        : '<div class="out-row"><span>Taxable value</span><b>' + CD.inr(amount) + '</b></div>' +
          '<div class="out-row"><span>CGST at ' + (rate / 2) + '%</span><b>' + CD.inr(split.cgst) + '</b></div>' +
          '<div class="out-row"><span>SGST at ' + (rate / 2) + '%</span><b>' + CD.inr(split.sgst) + '</b></div>'
      $('g-note').textContent = split.interState
        ? 'Different states, so this is an inter State supply and carries IGST on one line.'
        : 'Same state, so the tax splits equally across CGST and SGST.'
    }
    document.querySelectorAll('.tool-form input, .tool-form select').forEach((i) => i.addEventListener('input', run))
    run()`,
})

/* ── 4. rate ─────────────────────────────────────────────────────────────── */
const rateTool = toolPage({
  path: '/tools/rate-calculator',
  name: 'Rate calculator',
  h1: 'What should you charge for a post?',
  line: 'Brands buy attention by the thousand views. Tell it what one past deal paid, and it prices the next one at the same rate.',
  description:
    'Work out what to charge for a Reel, a Short or a video, from a deal you have already done. Free rate calculator for Indian creators.',
  form: `
    <p class="hint" style="margin:0 0 4px">
      <b style="color:var(--text)">Start from a deal you have done.</b>
      Most creators have no idea what their cost per view is, and they do not need to:
      one past fee and the views that post got contains it already.
    </p>
    ${field('fee', 'What a brand last paid you for one post', '', money('fee', 45000, 'min="0" step="1000"'), [['25K', 25000], ['45K', 45000], ['80K', 80000]])}
    ${field('pastviews', 'Views that post got', '', number('pastviews', 150000, 'min="0" step="1000"'))}
    <div class="rule"></div>
    ${field('views', 'Expected views on the new post', 'Average the last five of the same format.', number('views', 220000, 'min="0" step="1000"'))}
    <details class="advanced">
      <summary>I have never been paid for a post</summary>
      <div style="padding-top:14px;display:grid;gap:16px">
        <p class="hint" style="margin:0">
          Then set the band yourself and treat the answer as an opening position rather than a market rate.
          Nobody can honestly publish a going rate for every category.
        </p>
        ${field('cpmlow', 'Lower end, per thousand views', '', money('cpmlow', 200, 'min="0" step="10"'))}
        ${field('cpmhigh', 'Upper end, per thousand views', '', money('cpmhigh', 500, 'min="0" step="10"'))}
      </div>
    </details>`,
  out: `
    <div><span class="fine">Quote somewhere in here</span><div class="out-big figure" id="range">-</div></div>
    <div class="out-row"><span>Your rate per thousand views</span><b id="cpm">-</b></div>
    <div class="out-row"><span>Straight multiple of the last deal</span><b id="mid">-</b></div>
    <p class="tool-note">Then add for exclusivity, for usage rights, and for anything needing a second shoot day. Those are separate line items, not goodwill.</p>`,
  how: 'Cost per thousand views is the unit a brand is actually buying, and the one number that lets you compare a Reel with a fourteen minute video. Working it backwards out of a deal you have already closed gives you your own figure rather than somebody else\'s average, which is the only defensible one in a negotiation.',
  script: `
    const $ = (id) => document.getElementById(id)
    document.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => {
      const target = $(b.dataset.for)
      target.value = b.dataset.value
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }))
    function run() {
      const fee = Number($('fee').value) || 0
      const past = Number($('pastviews').value) || 0
      const views = Number($('views').value) || 0
      const own = CD.cpmFromDeal(fee, past)
      // Her own rate when there is one, and the band she set when there is not.
      const low = own > 0 ? own * 0.85 : Number($('cpmlow').value) || 0
      const high = own > 0 ? own * 1.25 : Number($('cpmhigh').value) || 0
      const r = CD.rateFromReach(views, Math.min(low, high), Math.max(low, high))
      $('range').textContent = CD.inr(r.low) + ' to ' + CD.inr(r.high)
      $('cpm').textContent = own > 0 ? CD.inr(own) : 'set your band'
      $('mid').textContent = own > 0 ? CD.inr((own / 1000) * views) : '-'
    }
    document.querySelectorAll('.tool-form input').forEach((i) => i.addEventListener('input', run))
    run()`,
})

/* ── 5. engagement ───────────────────────────────────────────────────────── */
const engagementTool = toolPage({
  path: '/tools/engagement-rate-calculator',
  name: 'Engagement rate calculator',
  h1: 'Engagement rate calculator',
  line: 'The first number a brand asks for, worked out both ways they mean it.',
  description:
    'Work out your engagement rate on followers and on reach, the two ways brands ask for it. Free calculator for Instagram and YouTube creators.',
  form: `
    ${field('followers', 'Followers', '', number('followers', 184000, 'min="0" step="100"'))}
    ${field('reach', 'Reach on the post', 'Leave at zero if you only want the follower figure.', number('reach', 96000, 'min="0" step="100"'))}
    ${field('likes', 'Likes', '', number('likes', 8400, 'min="0" step="10"'))}
    ${field('comments', 'Comments', '', number('comments', 320, 'min="0" step="1"'))}
    ${field('saves', 'Saves and shares', '', number('saves', 1100, 'min="0" step="10"'))}`,
  out: `
    <div><span class="fine">On followers</span><div class="out-big figure" id="erf">-</div></div>
    <div class="out-row"><span>On reach</span><b id="err">-</b></div>
    <div class="out-row"><span>Total interactions</span><b id="eri">-</b></div>
    <p class="tool-note">On followers is the media kit number. On reach describes how one post actually did, and is the more useful of the two.</p>`,
  how: 'Interactions divided by the denominator, times one hundred. Saves and shares are counted because on Reels they carry more weight with the algorithm than a like does, and brands increasingly ask for them separately.',
  script: `
    const $ = (id) => document.getElementById(id)
    document.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => {
      const target = $(b.dataset.for)
      target.value = b.dataset.value
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }))
    const pct = (n) => n.toFixed(2) + '%'
    function run() {
      const f = Number($('followers').value) || 0
      const r = Number($('reach').value) || 0
      const l = Number($('likes').value) || 0
      const c = Number($('comments').value) || 0
      const s = Number($('saves').value) || 0
      $('erf').textContent = f ? pct(CD.engagement(l, c, s, f)) : '-'
      $('err').textContent = r ? pct(CD.engagement(l, c, s, r)) : 'add reach above'
      $('eri').textContent = (l + c + s).toLocaleString('en-IN')
    }
    document.querySelectorAll('.tool-form input').forEach((i) => i.addEventListener('input', run))
    run()`,
})

/* ── the index ───────────────────────────────────────────────────────────── */
const index = {
  path: '/tools',
  title: 'Free calculators for Indian creators | Blubanana',
  description:
    'Five free calculators for content creators in India: advance tax, TDS, GST, what to charge, and engagement rate. No sign up, nothing to install.',
  body: `
<section class="hero" style="padding-bottom:0">
  <div class="container">
    <div class="eyebrow reveal">Free tools</div>
    <h1 class="reveal" style="max-width:16ch">Five calculators, no sign up</h1>
    <p class="lede reveal" style="max-width:54ch;margin-top:18px">
      The arithmetic every Indian creator ends up doing on the back of a notebook, done properly. Nothing to install and no email required.
    </p>
  </div>
</section>

<section class="band">
  <div class="container">
    <div class="grid g-2 reveal">
      ${TOOLS.map(
        ([href, title, note]) => `<a class="card tool-card" href="${href}">
        <div class="icon-badge">${icon('chart')}</div>
        <h4>${title}</h4>
        <p>${note}</p>
        <span class="link-arrow" style="margin-top:14px">Open it</span>
      </a>`
      ).join('')}
    </div>
  </div>
</section>

${closingCta({
  title: 'The app does all of this from your real deals',
  sub: `And reminds you before the date rather than after. ${PRICING.trialDays} days free, no card.`,
  href: SITE.signup,
})}`,
}

export default [index, advanceTax, tdsTool, gstTool, rateTool, engagementTool]
