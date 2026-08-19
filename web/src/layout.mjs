// The shell every page is poured into.
//
// Header, footer and <head> live here and nowhere else, so a nav item added
// once appears on thirty pages and cannot drift between them. That is the
// entire reason this site is generated rather than hand-written: the previous
// version kept its header in six copies.

import { COMPANY, FOOTER, NAV, PRICING, SITE, SUPABASE } from './site.mjs'

/** The mark, as inline SVG — the same C the app draws and the invoice carries. */
const LOGO = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M27 8.5A12.5 12.5 0 1 0 27 23.5" stroke="#3B6EF6" stroke-width="5" stroke-linecap="round"/></svg>`

const CHEV = `<svg class="chev" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const BURGER = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`

const THEME_ICONS = `<svg class="sun" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="4"/><path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.6 4.6l1.4 1.4M16 16l1.4 1.4M17.4 4.6 16 6M6 16l-1.4 1.4"/></svg><svg class="moon" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13.4A7.6 7.6 0 0 1 8.6 4 7.6 7.6 0 1 0 18 13.4Z"/></svg>`

function header() {
  const items = NAV.map((entry) => {
    if (!entry.items) {
      return `<div class="nav-item"><a class="nav-link" href="${entry.href}">${entry.label}</a></div>`
    }
    const menu = entry.items
      .map(([href, title, note]) => `<a href="${href}"><span class="mt">${title}</span><span class="md">${note}</span></a>`)
      .join('')
    return `<div class="nav-item">
        <button class="nav-link" aria-expanded="false">${entry.label}${CHEV}</button>
        <div class="menu">${menu}</div>
      </div>`
  }).join('')

  return `<header class="header">
  <div class="container">
    <a class="logo" href="/">${LOGO} ${SITE.name}</a>
    <nav class="nav">${items}</nav>
    <div class="nav-actions">
      <button class="theme-toggle" aria-label="Switch between light and dark">${THEME_ICONS}</button>
      <a class="login" href="${SITE.login}">Log in</a>
      <a class="btn btn-sm" href="${SITE.signup}">Start free</a>
      <button class="burger" aria-label="Open menu" aria-expanded="false">${BURGER}</button>
    </div>
  </div>
</header>

<div class="sheet" id="sheet">
  <div class="sheet-top">
    <a class="logo" href="/">${LOGO} ${SITE.name}</a>
    <button class="burger" aria-label="Close menu">✕</button>
  </div>
  ${NAV.map((entry) =>
    entry.items
      ? `<h5>${entry.label}</h5>${entry.items.map(([href, title]) => `<a href="${href}">${title}</a>`).join('')}`
      : `<a href="${entry.href}">${entry.label}</a>`
  ).join('')}
  <a class="btn" href="${SITE.signup}">Start free</a>
  <a class="btn btn-ghost" href="${SITE.login}" style="display:flex;margin-top:10px">Log in</a>
</div>`
}

function footer() {
  const columns = FOOTER.map(
    (col) => `<div>
      <h5>${col.title}</h5>
      <ul>${col.links.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul>
    </div>`
  ).join('')

  return `<footer class="footer">
  <div class="container">
    <div class="footer-cols">
      <div>
        <a class="logo" href="/" style="margin-bottom:16px">${LOGO} ${SITE.name}</a>
        <p class="fine" style="margin-bottom:10px">${SITE.tagline}. Built in India, for Indian creators.</p>
        <p class="fine">${COMPANY.address}</p>
        <p class="fine"><a href="mailto:${COMPANY.email}">${COMPANY.email}</a> · ${COMPANY.phone}</p>
      </div>
      ${columns}
    </div>
    <div class="footer-base">
      <span>© ${new Date().getFullYear()} ${COMPANY.legalName}. All rights reserved.</span>
      <span>Payments by Razorpay · Brands pay you directly, never through us.</span>
    </div>
  </div>
</footer>`
}

/**
 * Wraps a page's body.
 *
 * `announce` is the launch-offer bar. It carries the fallback seat count from
 * build time and is corrected at runtime by app.js, which asks the database
 * how many of the 500 places have actually gone. If that call fails the
 * build-time figure stands — a number slightly out of date is honest; a
 * counter that renders blank looks broken.
 */
export function page({ title, description, path, body, schema = [], announce = true, script = '' }) {
  const canonical = `${SITE.origin}${path === '/' ? '' : path}`
  const structured = schema.length
    ? `<script type="application/ld+json">${JSON.stringify(schema.length === 1 ? schema[0] : schema)}</script>`
    : ''

  // The anon key on the root element, for app.js to read. It is public client
  // config — the app already ships it inside its own JavaScript bundle — and
  // every table it can reach through it is one migration 035 deliberately
  // granted to `anon`: the price list and the count of launch places taken.
  const supabase = SUPABASE.url
    ? ` data-supabase-url="${SUPABASE.url}" data-supabase-key="${SUPABASE.anonKey}"`
    : ''
  // The seat cap as a fallback, so the launch banner can still say how many
  // places are left when only the seat-count function answers.
  const fallbacks = ` data-intro-seats="${PRICING.introSeats}"`

  return `<!DOCTYPE html>
<html lang="en"${supabase}${fallbacks}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#08080C">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE.origin}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400..700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400..700&display=swap">
<link rel="stylesheet" href="/styles.css">
<script>
  /* Applied before the first paint. A stored preference arriving a frame late
     is a white flash on a dark page, which is worse than no toggle at all. */
  try {
    var t = localStorage.getItem('cd-theme')
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
  } catch (e) {}
</script>
${structured}
</head>
<body>
${announce ? announceBar() : ''}
${header()}
<main>
${body}
</main>
${footer()}
<script src="/app.js" defer></script>
${script ? `<script src="/tools.js"></script>\n<script>${script}</script>` : ''}
</body>
</html>`
}

/**
 * The launch offer, without a running total.
 *
 * The 500 cap is what makes the struck through price honest, and it stays in
 * the database. Publishing how many places are *left* is a different claim:
 * early on it reads as "nobody has joined", which is true and unhelpful, and it
 * invites a visitor to count the customers rather than read the offer. The
 * counter turns itself on only once the number flatters rather than deters, and
 * app.js owns that threshold.
 */
function announceBar() {
  return `<div class="announce" id="announce" hidden>
  <span><b>Launch offer.</b> 50% off for the first 500 creators<span data-seats-line hidden>, and <b><span data-seats-left></span> places are left</span></span>
  <button class="announce-close" aria-label="Dismiss">✕</button>
</div>`
}
