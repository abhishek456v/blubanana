// The shell every page is poured into.
//
// Header, footer and <head> live here and nowhere else, so a nav item added
// once appears on thirty pages and cannot drift between them. That is the
// entire reason this site is generated rather than hand-written: the previous
// version kept its header in six copies.

import { ANALYTICS, COMPANY, FOOTER, NAV, PRICING, SITE, SUPABASE } from './site.mjs'
import { PRODUCT_NAV } from './content/product.mjs'

/**
 * The wordmark.
 *
 * Set in lower case with "blu" carrying the accent, which is the whole logo:
 * two words, one colour break, no icon. A mark drawn badly is worse than no
 * mark, and a name this distinctive does not need one to be recognisable.
 */
const LOGO = `<span class="wm"><span class="wm-a">${SITE.wordmark[0]}</span>${SITE.wordmark[1]}</span>`

const CHEV = `<svg class="chev" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const BURGER = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`

const THEME_ICONS = `<svg class="sun" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="4"/><path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.6 4.6l1.4 1.4M16 16l1.4 1.4M17.4 4.6 16 6M6 16l-1.4 1.4"/></svg><svg class="moon" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13.4A7.6 7.6 0 0 1 8.6 4 7.6 7.6 0 1 0 18 13.4Z"/></svg>`

/** The feature pages describe themselves, so a new one joins the menu by existing. */
const resolve = (items) => (items === 'product' ? PRODUCT_NAV : items)

function header() {
  const items = NAV.map((entry) => {
    const menu_items = resolve(entry.items)
    if (!menu_items) {
      return `<div class="nav-item"><a class="nav-link" href="${entry.href}">${entry.label}</a></div>`
    }
    const menu = menu_items
      .map(([href, title, note]) => `<a href="${href}"><span class="mt">${title}</span><span class="md">${note}</span></a>`)
      .join('')
    // The parent is a real link as well as a menu. Making a visitor open a
    // dropdown to reach the section it is named after is a small tax charged on
    // every visit, and the menu still opens on hover for anyone who wants it.
    return `<div class="nav-item">
        <a class="nav-link" href="${entry.href}">${entry.label}${CHEV}</a>
        <div class="menu">${menu}</div>
      </div>`
  }).join('')

  return `<header class="header">
  <div class="container">
    <a class="logo" href="/">${LOGO}</a>
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
    <a class="logo" href="/">${LOGO}</a>
    <button class="burger" aria-label="Close menu">✕</button>
  </div>
  ${NAV.map((entry) =>
    entry.items
      ? `<h5><a href="${entry.href}" style="padding:0;border:none;font:inherit;color:inherit">${entry.label}</a></h5>${resolve(entry.items).map(([href, title]) => `<a href="${href}">${title}</a>`).join('')}`
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
      <ul>${resolve(col.links).map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul>
    </div>`
  ).join('')

  return `<footer class="footer">
  <div class="container">
    <div class="footer-cols">
      <div>
        <a class="logo" href="/" style="margin-bottom:16px">${LOGO}</a>
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
/**
 * `assets` carries content hashed filenames.
 *
 * Without them a browser that has seen this site before keeps serving itself
 * the old stylesheet, and a redesign appears not to have happened. That is not
 * hypothetical: it is exactly what went wrong on the first review of this
 * rebuild. A hash in the filename makes a stale cache impossible rather than
 * unlikely.
 */
export function page({ title, description, path, body, schema = [], announce = true, script = '', assets }) {
  const canonical = `${SITE.origin}${path === '/' ? '' : path}`

  /**
   * Google Analytics, loaded only after consent.
   *
   * The tag is not on the page at all until someone accepts. The usual
   * pattern ships gtag immediately and sets `consent: denied` first, which
   * still contacts Google on every visit; under the DPDP Act the safer
   * reading is that nothing should be requested before permission, so the
   * script element is created by the banner rather than being present and
   * gagged.
   *
   * Returns nothing at all when no Measurement ID is configured, so a build
   * without one carries no analytics code, no banner and no cookies.
   */
  function analytics() {
    if (!ANALYTICS.measurementId) return ''
    return `<script>
  window.__gaId = ${JSON.stringify(ANALYTICS.measurementId)};
  window.__gaLoad = function () {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + window.__gaId;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    /* IP anonymisation is the default in GA4 and cannot be switched off,
       so there is nothing to set here beyond the property itself. */
    window.gtag('config', window.__gaId);
  };
  try {
    if (localStorage.getItem('bb-consent') === 'yes') window.__gaLoad();
  } catch (e) {}
</script>`
  }

  /**
   * The consent banner.
   *
   * Only rendered when analytics is configured, because a site that sets no
   * cookies has nothing to ask about, and a banner on such a site is theatre.
   * Both answers are stored, so the question is asked once.
   */
  function consentBanner() {
    if (!ANALYTICS.measurementId) return ''
    return `<div class="consent" id="consent" hidden>
  <p class="consent-text">We use Google Analytics to see which pages are read. No advertising, and nothing is shared with anyone else. <a href="/privacy">How we handle data</a>.</p>
  <div class="consent-actions">
    <button type="button" class="btn btn-ghost btn-sm" data-consent="no">Decline</button>
    <button type="button" class="btn btn-primary btn-sm" data-consent="yes">Accept</button>
  </div>
</div>
<script>
  (function () {
    var el = document.getElementById('consent');
    if (!el) return;
    var stored;
    try { stored = localStorage.getItem('bb-consent'); } catch (e) {}
    if (!stored) el.hidden = false;
    el.addEventListener('click', function (event) {
      var answer = event.target && event.target.getAttribute('data-consent');
      if (!answer) return;
      try { localStorage.setItem('bb-consent', answer); } catch (e) {}
      el.hidden = true;
      if (answer === 'yes' && window.__gaLoad) window.__gaLoad();
    });
  })();
</script>`
  }
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
<!-- Two, because there is no one right answer. A single theme-color painted
     the phone's browser chrome near-black above a white page, and the value
     it used was not even the dark ground: the page is #000, this said #08080C. -->
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
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
<link rel="stylesheet" href="${assets.css}">
<script>
  /* Applied before the first paint. A stored preference arriving a frame late
     is a white flash on a dark page, which is worse than no toggle at all. */
  try {
    var t = localStorage.getItem('cd-theme')
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
  } catch (e) {}
</script>
${structured}
${analytics()}
</head>
<body>
${consentBanner()}
${announce ? announceBar() : ''}
${header()}
<main>
${body}
</main>
${footer()}
<script src="${assets.js}" defer></script>
${script ? `<script src="${assets.tools}"></script>\n<script>${script}</script>` : ''}
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
  <span><b>Launch offer.</b> 50% off for the first 500 creators<span data-seats-line hidden>, and <b data-seats-left></b> places are left</span></span>
  <button class="announce-close" aria-label="Dismiss">✕</button>
</div>`
}
