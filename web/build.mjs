// Builds the site.
//
//   node web/build.mjs            → web/dist, and refuses to finish if a
//                                    placeholder or a broken link is left in
//   node web/build.mjs --draft    → same, but warns instead of failing
//
// Static HTML, no framework, nothing to install. The output is committed so it
// can be dropped onto any static host without a build step running there.
//
// The checks at the bottom are the point of having a build at all. The previous
// version of this site shipped with a placeholder phone number, which is the
// one thing that fails a Razorpay merchant activation — so the build now treats
// that as an error rather than a note in a README nobody re-reads.

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { page } from './src/layout.mjs'
import { SITE } from './src/site.mjs'

import home from './src/content/home.mjs'
import pricing from './src/content/pricing.mjs'
import contact from './src/content/contact.mjs'
import terms from './src/content/terms.mjs'
import privacy from './src/content/privacy.mjs'
import refunds from './src/content/refunds.mjs'

const DRAFT = process.argv.includes('--draft')
const ROOT = dirname(fileURLToPath(import.meta.url))
const DIST = join(ROOT, 'dist')

const PAGES = [home, pricing, contact, terms, privacy, refunds]

rmSync(DIST, { recursive: true, force: true })
mkdirSync(DIST, { recursive: true })

// ── render ──────────────────────────────────────────────────────────────────
const written = []
for (const spec of PAGES) {
  const html = page(spec)
  // Clean URLs: /pricing is a directory with an index.html in it, so the site
  // works identically on Cloudflare Pages, Netlify, S3 and a plain nginx.
  const dir = spec.path === '/' ? DIST : join(DIST, spec.path.replace(/^\//, ''))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
  written.push({ ...spec, html, file: join(dir, 'index.html') })
}

// ── static files ────────────────────────────────────────────────────────────
cpSync(join(ROOT, 'styles.css'), join(DIST, 'styles.css'))
cpSync(join(ROOT, 'app.js'), join(DIST, 'app.js'))
cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true })

writeFileSync(
  join(DIST, 'assets', 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#08080C"/><path d="M25.5 9.8A11 11 0 1 0 25.5 22.2" stroke="#3B6EF6" stroke-width="4.6" stroke-linecap="round" fill="none"/></svg>`
)

writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${SITE.origin}${p.path === '/' ? '/' : p.path}</loc></url>`).join('\n')}
</urlset>
`
)

writeFileSync(
  join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n`
)

// ── checks ──────────────────────────────────────────────────────────────────
const problems = []
const warn = (message) => problems.push(message)

const routes = new Set(PAGES.map((p) => p.path))

for (const p of written) {
  // Internal links must land somewhere. A nav that points at a page nobody has
  // built yet is the specific way a growing site rots, and it is invisible
  // until a visitor finds it.
  for (const [, href] of p.html.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)) {
    const path = href.replace(/\/$/, '') || '/'
    if (path.startsWith('/assets/') || path === '/styles.css' || path === '/app.js') continue
    if (!routes.has(path)) warn(`${p.path} → dead link ${href}`)
  }
  // Every image the markup asks for must exist in the asset folder.
  for (const [, src] of p.html.matchAll(/src="(\/assets\/[^"]+)"/g)) {
    if (!existsSync(join(DIST, src.replace(/^\//, '')))) warn(`${p.path} → missing asset ${src}`)
  }
  if (!/<h1[ >]/.test(p.html) && p.path === '/') warn(`${p.path} → no <h1>`)
  if ((p.html.match(/<h1[ >]/g) ?? []).length > 1) warn(`${p.path} → more than one <h1>`)
  if (!p.description || p.description.length < 60) warn(`${p.path} → description too short for search results`)
  if (p.title.length > 65) warn(`${p.path} → title over 65 characters, search will truncate it`)

  // The blocker. Razorpay's reviewers call the number on the contact page.
  const todos = [...p.html.matchAll(/TODO[^<"]*/g)].map((m) => m[0].trim())
  for (const todo of new Set(todos)) warn(`${p.path} → placeholder: "${todo}"`)
}

const size = readdirSync(join(DIST, 'assets')).length
console.log(`\n${written.length} pages · ${size} asset files · dist/`)
for (const p of written) console.log(`  ${p.path.padEnd(12)} ${(p.html.length / 1024).toFixed(0)}KB`)

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`)
  for (const problem of problems) console.log(`  - ${problem}`)
  if (!DRAFT) {
    console.log('\nBuild failed. Fix these, or pass --draft to build anyway.')
    process.exit(1)
  }
  console.log('\n(--draft: built anyway)')
} else {
  console.log('\nNo problems.')
}
