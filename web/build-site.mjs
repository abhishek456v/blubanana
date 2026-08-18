// Generates the marketing site's shared chrome so five pages cannot drift.
// Run: node build-site.mjs <outdir>
import { writeFileSync } from 'node:fs'

const out = process.argv[2]
const PLATFORM = 'https://platform.creatordesk.in'

// Every placeholder a human must replace before this goes live, in one place so
// none is missed. Razorpay rejects an activation with placeholder contact
// details, so these are blocking rather than cosmetic.
const TODO = {
  email: 'hello@creatordesk.in',
  phone: '+91 XXXXX XXXXX',
  address: 'Registered address, City, State, PIN',
  entity: 'CreatorDesk',
  gstin: 'GSTIN to be added',
}

const page = ({ title, description, body, active = '' }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:type" content="website" />
<meta name="theme-color" content="#08080C" />
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<header>
  <a class="logo" href="index.html"><span class="logo-mark"></span> CreatorDesk</a>
  <nav>
    <a href="index.html#what"${active === 'what' ? ' style="color:#fff"' : ''}>What it does</a>
    <a href="pricing.html"${active === 'pricing' ? ' style="color:#fff"' : ''}>Pricing</a>
    <a href="contact.html"${active === 'contact' ? ' style="color:#fff"' : ''}>Contact</a>
    <a class="btn" href="${PLATFORM}">Start free</a>
  </nav>
</header>
${body}
<footer>
  <div class="wrap footer-cols">
    <div>
      <div class="logo" style="margin-bottom:10px"><span class="logo-mark"></span> CreatorDesk</div>
      <div>${TODO.entity} · ${TODO.address}</div>
      <div><a href="mailto:${TODO.email}">${TODO.email}</a> · ${TODO.phone}</div>
    </div>
    <div class="footer-links">
      <a href="pricing.html">Pricing</a>
      <a href="contact.html">Contact</a>
      <a href="terms.html">Terms</a>
      <a href="privacy.html">Privacy</a>
      <a href="refunds.html">Cancellation &amp; refunds</a>
    </div>
  </div>
</footer>
</body>
</html>
`

// ── Landing ─────────────────────────────────────────────────────────────────
writeFileSync(`${out}/index.html`, page({
  title: 'CreatorDesk — the business side of being a creator',
  description: 'Track brand deals, never miss a deadline, invoice with GST, and get paid on time. Built for Indian creators.',
  body: `
<div class="wrap hero">
  <h1>The business side of being a creator.</h1>
  <p class="lede">
    Every brand deal, every deadline, every invoice and every rupee still owed to you —
    in one place, on your phone. Built for how creators actually work in India.
  </p>
  <div class="hero-actions">
    <a class="btn" href="${PLATFORM}">Start your 14-day trial</a>
    <a class="btn ghost" href="pricing.html">See pricing</a>
  </div>
  <p class="hero-note">No card needed to start. 10 deals during the trial, everything else unlimited.</p>
</div>

<section id="what" class="wrap">
  <h2>What it actually does</h2>
  <p class="section-lede">
    Not a to-do list with a creator theme. The specific work that sits between
    agreeing a deal and the money arriving.
  </p>
  <div class="grid">
    <div class="card">
      <div class="kicker">Thirty seconds</div>
      <h3>Log a deal from the DM</h3>
      <p>Screenshot the brand's message or say it out loud. The brief, the rate, the
      dates and the deliverables are read out and filled in for you to check.</p>
    </div>
    <div class="card">
      <div class="kicker">Never again</div>
      <h3>Miss a deadline</h3>
      <p>Script, shoot, edit, publish — each with its own date, and a reminder that
      arrives before it matters. Sent from our servers, so they reach you whether or
      not the app is open.</p>
    </div>
    <div class="card">
      <div class="kicker">Rule 46</div>
      <h3>GST invoices that hold up</h3>
      <p>Correct CGST/SGST or IGST from the place of supply, TDS recorded properly,
      and a UPI QR on the invoice so the brand can pay while it is open.</p>
    </div>
    <div class="card">
      <div class="kicker">The awkward part</div>
      <h3>Chase payment without the dread</h3>
      <p>A written, professional follow-up ready to send on WhatsApp, escalating in
      firmness the longer it goes. You approve every message before it sends.</p>
    </div>
    <div class="card">
      <div class="kicker">March, not a panic</div>
      <h3>Tax you can hand to a CA</h3>
      <p>Income, expenses, TDS and GST for the financial year — gross and net, so
      "tax-ready" means what you are taxed on, not what you turned over.</p>
    </div>
    <div class="card">
      <div class="kicker">When they ask</div>
      <h3>A rate card that stays true</h3>
      <p>Built from what you have actually charged, not what you wish you charged.
      Send it the moment a brand asks for your commercials.</p>
    </div>
  </div>
</section>

<section class="wrap">
  <h2>Works with no signal</h2>
  <p class="section-lede">
    The moment that matters most is on a shoot, in a basement studio, with one bar.
    Log the deal anyway — it saves to your phone and syncs itself when you are back.
  </p>
</section>

<section class="wrap">
  <div class="price-card">
    <div class="offer">✦ Launch offer · 50% off for the first 500 creators</div>
    <div class="price"><span class="now">₹999</span><span class="was">₹1,999</span></div>
    <p class="price-meta">per month + GST · or ₹9,590 a year, which works out at ₹799 a month</p>
    <ul class="includes">
      <li>Every feature, with nothing held back</li>
      <li>Up to 5 people in your workspace</li>
      <li>Unlimited deals, brands, invoices and expenses</li>
      <li>Your data exportable at any time</li>
    </ul>
    <a class="btn" href="${PLATFORM}">Start your 14-day trial</a>
  </div>
</section>
`,
  active: 'what',
}))

// ── Pricing ─────────────────────────────────────────────────────────────────
writeFileSync(`${out}/pricing.html`, page({
  title: 'Pricing — CreatorDesk',
  description: 'One plan, every feature. ₹999 a month during the launch offer, or ₹9,590 a year.',
  active: 'pricing',
  body: `
<div class="wrap legal prose">
  <h1>Pricing</h1>
  <p class="updated">All prices in Indian rupees, exclusive of GST at 18%.</p>

  <p>One plan. Every feature, including team invites — the only thing that changes
  is how long you pay for at a time.</p>

  <div class="callout"><p><strong>Launch offer:</strong> 50% off for the first 500 creators.
  When those places are taken the offer ends and the list price applies.</p></div>

  <table class="terms">
    <tr><th>Term</th><th class="num">List price</th><th class="num">You pay now</th><th class="num">Per month</th></tr>
    <tr><td>Monthly</td><td class="num">₹1,999</td><td class="num">₹999</td><td class="num">₹999</td></tr>
    <tr><td>3 months</td><td class="num">₹5,997</td><td class="num">₹2,997</td><td class="num">₹999</td></tr>
    <tr><td>6 months</td><td class="num">₹11,994</td><td class="num">₹5,994</td><td class="num">₹999</td></tr>
    <tr><td>9 months</td><td class="num">₹17,991</td><td class="num">₹8,991</td><td class="num">₹999</td></tr>
    <tr><td><strong>12 months</strong></td><td class="num">₹19,190</td><td class="num"><strong>₹9,590</strong></td><td class="num"><strong>₹799</strong></td></tr>
  </table>

  <h2>What is included</h2>
  <ul>
    <li>Unlimited deals, brands, contacts, payments, invoices and expenses</li>
    <li>Deadline and payment reminders, sent as notifications</li>
    <li>GST invoicing to Rule 46, TDS tracking and the advance-tax calculator</li>
    <li>Your shareable rate card</li>
    <li>Up to 5 people in one workspace</li>
    <li>Export of everything you have, at any time, including after your plan ends</li>
  </ul>

  <h2>The free trial</h2>
  <p>14 days, no card required. You can create up to 10 deals during the trial;
  everything else is unlimited. Reaching 10 does not end your trial early.</p>

  <h2>When a plan ends</h2>
  <p>Your workspace becomes read-only. Everything you have entered stays visible and
  exportable — we do not lock you out of your own records. Adding and editing resume
  as soon as you subscribe again.</p>

  <h2>Price changes</h2>
  <p>The price you pay is fixed for the term you buy. When that term ends, renewal is
  at whatever the price is then. If the amount changes you will be asked to approve
  the new mandate — your bank will not simply be charged more.</p>

  <p><a class="btn" href="${PLATFORM}">Start your 14-day trial</a></p>
</div>
`,
}))

console.log('generated index.html, pricing.html')

const today = '18 August 2026'

// ── Privacy ─────────────────────────────────────────────────────────────────
// Written from what the code actually does, not from a template. Every
// processor named below appears in this repository.
writeFileSync(`${out}/privacy.html`, page({
  title: 'Privacy Policy — CreatorDesk',
  description: 'What CreatorDesk collects, why, who it is shared with, and how to have it deleted.',
  body: `
<div class="wrap legal prose">
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated ${today}</p>

  <p>${TODO.entity} ("CreatorDesk", "we") provides software that helps content creators
  manage brand collaborations. This policy explains what we collect, why, who it goes
  to, and what you can require of us. It is written to the Digital Personal Data
  Protection Act, 2023.</p>

  <h2>Who is responsible</h2>
  <p>CreatorDesk is the Data Fiduciary for the personal data described here.
  Questions, requests and complaints: <a href="mailto:${TODO.email}">${TODO.email}</a>.</p>

  <h2>What we collect, and why</h2>
  <ul>
    <li><strong>Your account</strong> — name, email address, phone number. To create your
    workspace, sign you in and contact you about your account.</li>
    <li><strong>Your business details</strong> — niche, follower count, GSTIN, PAN where
    provided, address, UPI ID and bank account details. Used to produce your invoices and
    tax figures. We never initiate a payment to or from these.</li>
    <li><strong>Your work</strong> — brand deals, rates, deadlines, payments, invoices,
    expenses and notes you enter.</li>
    <li><strong>Contacts at brands you work with</strong> — names, phone numbers and email
    addresses you record. This is personal data about other people, and we process it only
    to provide the service to you.</li>
    <li><strong>Files you upload</strong> — contracts, briefs, screenshots and profile
    photographs.</li>
    <li><strong>Device tokens</strong> — so reminders can reach your phone.</li>
    <li><strong>Social account data</strong> — only if you connect Instagram: your handle,
    follower and engagement figures, and view counts on posts you have linked to a deal.</li>
  </ul>

  <h2>What we do not do</h2>
  <ul>
    <li>We do not sell your data, and we do not share it for anyone else's advertising.</li>
    <li>We do not use your deals, rates or contacts to train AI models.</li>
    <li>We never touch money between you and a brand. Invoices and UPI QR codes are
    documents; the payment goes directly to your account.</li>
    <li>We cannot see your card or UPI credentials when you pay us. Those go to our
    payment gateway and never reach our servers.</li>
  </ul>

  <h2>Who processes it for us</h2>
  <ul>
    <li><strong>Supabase</strong> — database, authentication and file storage.</li>
    <li><strong>OpenAI</strong> — reading a screenshot or voice note you choose to submit,
    and suggesting a rate for a format you have not sold. Only the content of that
    specific request is sent.</li>
    <li><strong>Razorpay</strong> — collecting your subscription payment.</li>
    <li><strong>Expo</strong> — delivering push notifications to your device.</li>
    <li><strong>Meta</strong> — only if you connect Instagram, to read your own figures.</li>
  </ul>

  <h2>How long we keep it</h2>
  <p>For as long as your account exists. When you delete your account, your workspace and
  everything in it is permanently deleted, including uploaded files.</p>
  <p>One exception: tax invoices we issue to you are retained for six years, as Indian GST
  law requires. Those carry your name and GSTIN and nothing else about your work.</p>

  <h2>Your rights</h2>
  <ul>
    <li><strong>Access and portability</strong> — Settings → Export my data gives you
    everything, as CSV and JSON, at any time. This works even after your plan has ended.</li>
    <li><strong>Correction</strong> — every field is editable in the app.</li>
    <li><strong>Erasure</strong> — Settings → Delete my account. This is a real deletion,
    not a deactivation, and it cannot be undone.</li>
    <li><strong>Grievance</strong> — write to <a href="mailto:${TODO.email}">${TODO.email}</a>.
    We will respond within the period the DPDP Act requires.</li>
  </ul>

  <h2>Security</h2>
  <p>Data is encrypted in transit and at rest. Access is enforced at the database level:
  one creator's records are unreachable from another's account, and the rule is applied by
  the database itself rather than by the app asking nicely. Payment credentials never reach
  our servers.</p>

  <h2>Children</h2>
  <p>CreatorDesk is not intended for anyone under 18, and we do not knowingly create
  accounts for children.</p>

  <h2>Changes</h2>
  <p>If this policy changes materially we will tell you in the app before the change takes
  effect.</p>
</div>
`,
}))

// ── Terms ───────────────────────────────────────────────────────────────────
writeFileSync(`${out}/terms.html`, page({
  title: 'Terms and Conditions — CreatorDesk',
  description: 'The terms on which CreatorDesk is provided.',
  body: `
<div class="wrap legal prose">
  <h1>Terms and Conditions</h1>
  <p class="updated">Last updated ${today}</p>

  <p>These terms govern your use of CreatorDesk, provided by ${TODO.entity}. By creating an
  account you agree to them.</p>

  <h2>What we provide</h2>
  <p>Software for managing brand collaborations: recording deals, tracking deadlines,
  generating invoices, and calculating tax figures from what you enter.</p>

  <h2>What we are not</h2>
  <ul>
    <li><strong>We are not your accountant.</strong> Tax figures are calculated from what you
    enter and are a starting point for you and your CA, not filed advice.</li>
    <li><strong>We are not a payment processor for your deals.</strong> Money moves directly
    between you and the brand. We never hold it.</li>
    <li><strong>We are not a party to your brand agreements.</strong> Invoices and messages
    the app helps you produce are yours, sent under your name.</li>
  </ul>

  <h2>Your account</h2>
  <p>You are responsible for keeping your login secure and for what is done through it. You
  may invite up to 5 people into your workspace; what they do there is your responsibility.</p>

  <h2>Your data is yours</h2>
  <p>You keep all rights to everything you enter. We claim no ownership over your deals,
  rates, contacts or files, and you can export all of it at any time.</p>

  <h2>Acceptable use</h2>
  <p>Do not use CreatorDesk to break the law, to send messages to people who have not agreed
  to hear from you, or to store data about others that you have no right to hold. Do not
  attempt to access another workspace.</p>

  <h2>Payment</h2>
  <p>Subscriptions are billed in advance for the term you choose, plus GST. See
  <a href="pricing.html">Pricing</a> and
  <a href="refunds.html">Cancellation &amp; Refunds</a>.</p>

  <h2>Availability</h2>
  <p>We work to keep the service running and will give notice of planned downtime where we
  can, but we do not guarantee uninterrupted availability. Reminders depend on your device
  and network, and we cannot guarantee delivery of any individual notification.</p>

  <h2>Ending it</h2>
  <p>You may cancel at any time. We may suspend or end an account that breaches these
  terms; where we do, you will still be able to export your data.</p>

  <h2>Liability</h2>
  <p>To the extent the law allows, our total liability is limited to what you paid us in the
  twelve months before the claim. We are not liable for missed deadlines, unpaid invoices or
  tax positions taken on the basis of figures in the app — those remain your decisions.</p>

  <h2>Governing law</h2>
  <p>These terms are governed by the laws of India, and the courts of our registered
  location have exclusive jurisdiction.</p>

  <h2>Contact</h2>
  <p><a href="mailto:${TODO.email}">${TODO.email}</a></p>
</div>
`,
}))

// ── Refunds ─────────────────────────────────────────────────────────────────
writeFileSync(`${out}/refunds.html`, page({
  title: 'Cancellation and Refunds — CreatorDesk',
  description: 'How to cancel a CreatorDesk subscription and when a refund applies.',
  body: `
<div class="wrap legal prose">
  <h1>Cancellation and Refunds</h1>
  <p class="updated">Last updated ${today}</p>

  <h2>The trial comes first</h2>
  <p>Every account starts with 14 days free and no card. The trial exists so that nobody
  has to pay to find out whether CreatorDesk suits them.</p>

  <h2>Cancelling</h2>
  <p>You can cancel at any time from Settings → Plan and billing, or by writing to
  <a href="mailto:${TODO.email}">${TODO.email}</a>. Cancelling stops the next renewal. You
  keep full access until the end of the term you have already paid for.</p>

  <h2>Refunds</h2>
  <p>If you cancel within <strong>7 days</strong> of a payment and have not used the service
  meaningfully in that period, we will refund that payment in full.</p>
  <p>After 7 days, payments for the current term are not refunded, because the term has been
  provided. We do not pro-rate a part-used term.</p>
  <p>If we charged you in error, or the service was unavailable for a prolonged period
  through our fault, write to us — we will put it right, and that is not limited to 7 days.</p>

  <h2>How a refund reaches you</h2>
  <p>Approved refunds are returned to the original payment method within 5 to 7 working
  days of approval. The time it takes to appear depends on your bank.</p>

  <h2>After your plan ends</h2>
  <p>Your workspace becomes read-only. Everything you entered stays visible and exportable
  for as long as your account exists — we do not delete your records or lock you out of
  them because a plan lapsed.</p>

  <h2>Questions</h2>
  <p><a href="mailto:${TODO.email}">${TODO.email}</a> · ${TODO.phone}</p>
</div>
`,
}))

// ── Contact ─────────────────────────────────────────────────────────────────
writeFileSync(`${out}/contact.html`, page({
  title: 'Contact — CreatorDesk',
  description: 'How to reach CreatorDesk: email, phone and registered address.',
  active: 'contact',
  body: `
<div class="wrap legal prose">
  <h1>Contact us</h1>
  <p class="updated">We answer every message from a person, not a bot.</p>

  <div class="grid" style="margin: 28px 0;">
    <div class="card">
      <div class="kicker">Email</div>
      <h3><a href="mailto:${TODO.email}">${TODO.email}</a></h3>
      <p>Support, billing and privacy requests. We reply within one working day.</p>
    </div>
    <div class="card">
      <div class="kicker">Phone</div>
      <h3>${TODO.phone}</h3>
      <p>Monday to Friday, 10:00 to 18:00 IST.</p>
    </div>
    <div class="card">
      <div class="kicker">Registered address</div>
      <h3>${TODO.entity}</h3>
      <p>${TODO.address}<br />${TODO.gstin}</p>
    </div>
  </div>

  <h2>Deleting your data</h2>
  <p>You do not need to write to us: Settings → Delete my account removes your workspace and
  everything in it permanently. If you would rather we did it, email us from the address on
  the account.</p>

  <h2>Grievance officer</h2>
  <p>For complaints under the Digital Personal Data Protection Act, 2023, write to
  <a href="mailto:${TODO.email}">${TODO.email}</a> with "Grievance" in the subject.</p>
</div>
`,
}))

console.log('generated privacy.html, terms.html, refunds.html, contact.html')
