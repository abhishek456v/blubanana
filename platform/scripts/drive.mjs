// Drives the running Expo web app in a real browser and screenshots it.
//
//   npx expo start --web --port 8081      (in another terminal)
//   node scripts/drive.mjs                (screenshots the sign-in screen)
//   node scripts/drive.mjs --email you@example.com --password ... --all
//
// Why this exists: everything else in the toolchain (tsc, the bundler) only
// proves the code compiles. It cannot tell you a screen rendered blank, a
// contrast is unreadable, or a card is missing. This opens the app the way a
// creator would and saves what it actually looks like.
//
// Console errors and failed network requests are collected and printed, since
// a React render error shows up as a blank frame with a message only the
// browser console ever sees.

import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const BASE = flag('url', 'http://localhost:8081')
// Relative to this file rather than to the shell's directory, so it lands in
// the repo's screenshots folder whether it is run from platform/ or the root.
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'screenshots')
const EMAIL = flag('email')
const PASSWORD = flag('password')
const DRIVE_ALL = args.includes('--all')
/** Extra in-app paths to visit after sign-in. Repeatable: --goto /reminders */
const GOTO = args.reduce(
  (paths, arg, i) => (arg === '--goto' && args[i + 1] ? [...paths, args[i + 1]] : paths),
  []
)
// Defaults to a phone width, since that is the layout that matters most and
// is below the 768px `wide` breakpoint. Pass --width 1280 to render the
// desktop sidebar / split-panel variants instead; they are a genuinely
// different code path, not just a reflow.
const VIEWPORT = {
  width: Number(flag('width', '420')),
  height: Number(flag('height', '1000')),
}
const COLOR_SCHEME = args.includes('--dark') ? 'dark' : 'light'
/** Prefix so light and dark runs don't overwrite each other's files. */
const PREFIX = flag('prefix', COLOR_SCHEME === 'dark' ? 'dark-' : '')

const problems = []

async function shoot(page, name) {
  await mkdir(OUT, { recursive: true })
  // Let entrance animations settle: Reanimated fades and staggers would
  // otherwise be caught mid-flight and every shot would look half-drawn.
  await page.waitForTimeout(900)
  const file = join(OUT, `${PREFIX}${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`  saved screenshots/${PREFIX}${name}.png`)
}

/**
 * Taps a control by name.
 *
 * Role first, raw text last. react-navigation keeps every tab's scene mounted,
 * so a bare `getByText('Money')` can match the Money screen's own heading,
 * which is in the DOM but hidden, and then time out waiting for it to become
 * visible while the tab button sits there unclicked.
 */
async function tap(page, text, { timeout = 4000 } = {}) {
  // Exact accessible name first, then substring.
  //
  // Playwright's `name` option is a case-insensitive *substring* match by
  // default, which is too loose for short nav labels: "You" also matches the
  // rail's avatar ("Abhishek Verma, open your profile") and Home's "Needs you"
  // filter chip. Combined with the last-match-first rule below, the icon rail
  // was reliably losing to the avatar sitting underneath it.
  const candidates = [
    page.getByRole('tab', { name: text, exact: true }),
    page.getByRole('button', { name: text, exact: true }),
    page.getByRole('tab', { name: text }),
    page.getByRole('button', { name: text }),
    page.getByText(text, { exact: false }),
  ]

  for (const candidate of candidates) {
    let matches = []
    try {
      matches = await candidate.all()
    } catch {
      matches = []
    }

    // Visible ones only, and decided up front rather than by waiting on each.
    //
    // react-navigation keeps every tab's scene mounted, so a nav label matches
    // several times over: once on the control and again on hidden copies
    // inside the scenes. Waiting on each in turn burned the whole budget on
    // elements that were never going to appear, which is why the icon rail
    // read as "could not find" even though its aria-label was right there.
    const visible = []
    for (const target of matches) {
      if (await target.isVisible().catch(() => false)) visible.push(target)
    }

    // Last visible match first: a modal is portaled to the end of the DOM, so
    // when a label exists both on the page and in the sheet above it ("Create
    // invoice" on deal detail and on the invoice form), the sheet's copy is
    // the one a user could actually press.
    for (const target of visible.reverse()) {
      try {
        await target.click({ timeout: 2000 })
        await page.waitForTimeout(700)
        return true
      } catch {
        // Covered or detached: try the next match / strategy.
      }
    }
  }

  console.log(`  (could not find "${text}")`)
  return false
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  colorScheme: COLOR_SCHEME,
})
const page = await context.newPage()

page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console: ${msg.text().slice(0, 300)}`)
})
page.on('pageerror', (err) => problems.push(`uncaught: ${err.message.slice(0, 300)}`))
page.on('requestfailed', (req) => {
  // Ignore the dev server's own hot-reload socket noise.
  if (req.url().includes('/_expo/') || req.url().includes('hot')) return

  /*
   * An aborted request is not a failure.
   *
   * Playwright raises `requestfailed` for a cancellation too, and navigating
   * between screens cancels whatever the previous one had in flight. Reported
   * as a problem, that produced the same line on every single run, which is
   * the way a real failure gets missed: a list of problems that always has
   * something in it stops being read.
   */
  const reason = req.failure()?.errorText ?? ''
  if (reason.includes('ERR_ABORTED')) return

  problems.push(`request failed (${reason}): ${req.url().slice(0, 110)}`)
})
// A 4xx/5xx is not a "failed request" to Playwright: the response arrived. It
// surfaces only as a bare "Failed to load resource: 400" in the console, with
// no URL, which is useless for finding the query at fault.
page.on('response', async (res) => {
  if (res.status() < 400) return
  if (res.url().includes('/_expo/')) return
  let body = ''
  try {
    body = (await res.text()).slice(0, 200)
  } catch {
    // Body already consumed or the response was a redirect.
  }
  problems.push(`HTTP ${res.status()} ${res.url().slice(0, 160)}${body ? `: ${body}` : ''}`)
})

console.log(`opening ${BASE} at ${VIEWPORT.width}x${VIEWPORT.height}, ${COLOR_SCHEME}`)
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120_000 })
// The first paint is Metro still resolving modules; wait for real content.
await page.waitForTimeout(3000)

await shoot(page, '01-landing')

if (EMAIL && PASSWORD) {
  console.log('signing in')
  await page.getByPlaceholder('you@example.com').fill(EMAIL)
  await page.getByPlaceholder('••••••••').first().fill(PASSWORD)
  await tap(page, 'Sign in')
  await page.waitForTimeout(4000)

  // A fresh browser context has no onboarding-dismissed flag, so an account
  // with an unfilled profile gets redirected to onboarding on every run.
  // Skip it; the driver's job is the screens behind it.
  if (await page.getByText('Skip', { exact: true }).first().isVisible().catch(() => false)) {
    console.log('skipping onboarding')
    await tap(page, 'Skip')
    await page.waitForTimeout(2000)
  }

  await shoot(page, '02-home')

  if (DRIVE_ALL) {
    for (const [tab, name] of [
      ['Work', '03-work'],
      ['Money', '04-money'],
      ['Brands', '05-brands'],
      ['You', '06-you'],
    ]) {
      console.log(`opening ${tab}`)
      if (await tap(page, tab)) await shoot(page, name)
    }
  }

  // Open the search overlay and run a query.
  const searchQuery = flag('search')
  if (searchQuery) {
    console.log(`searching "${searchQuery}"`)
    if (await tap(page, 'Search deals, brands and invoices')) {
      await page.getByPlaceholder('Deals, brands, invoice numbers').fill(searchQuery)
      await page.waitForTimeout(1200) // debounce + round trip
      await shoot(page, '09-search')
    }
  }

  // Open the first deal row, for the detail screen. Its id is a UUID that
  // changes per workspace, so it is reached by clicking rather than by URL.
  if (args.includes('--deal')) {
    console.log('opening the first deal')
    // Back to Home first. The deal rows live there, and with --all the run
    // ends on You, where nothing matches a brand name and the step reported
    // "could not find" for a deal that was never missing.
    if (DRIVE_ALL) {
      await tap(page, 'Home')
      await page.waitForTimeout(900)
    }
    if (await tap(page, 'Sony Music')) await shoot(page, '08-deal')
  }

// Generic follow-up clicks, screenshotting after each: --tap Next --tap Save
  const taps = args.reduce(
    (found, arg, i) => (arg === '--tap' && args[i + 1] ? [...found, args[i + 1]] : found),
    []
  )
  for (const [i, label] of taps.entries()) {
    console.log(`tapping "${label}"`)
    if (await tap(page, label)) await shoot(page, `10-tap-${i}-${label.replace(/\W+/g, '-')}`)
  }

  // Any route that isn't a tab. `--url` can't reach these: it lands before the
  // session exists, so the auth guard bounces to sign-in and the post-login
  // redirect goes to the app root, not the requested path.
  for (const path of GOTO) {
    console.log(`opening ${path}`)
    await page.goto(`${BASE.replace(/\/$/, '')}${path}`, {
      waitUntil: 'networkidle',
      timeout: 120_000,
    })
    await page.waitForTimeout(2500)
    await shoot(page, `07${path.replace(/\W+/g, '-')}`)
  }
} else {
  console.log('(no --email/--password given; stopping at the sign-in screen)')
}

console.log('')
if (problems.length === 0) {
  console.log('no console errors, no failed requests')
} else {
  console.log(`${problems.length} problem(s):`)
  for (const p of [...new Set(problems)].slice(0, 25)) console.log(`  - ${p}`)
}

await writeFile(join(OUT, `${PREFIX}problems.txt`), problems.join('\n'))
await browser.close()
