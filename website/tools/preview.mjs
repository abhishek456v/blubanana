// Opens the built site in a real browser and screenshots it.
//
//   node web/build.mjs --draft
//   cd web/dist && python3 -m http.server 4173
//   node web/tools/preview.mjs
//
// Same reasoning as scripts/drive.mjs for the app: the build proves the HTML
// was written, not that it renders. A missing image, a broken grid or a
// JavaScript error that empties the price all look identical to a build that
// succeeded.

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:4173'
// Relative to this file, not to the shell's directory. Resolving from the cwd
// created a website/web/.preview the first time it was run from inside
// website/, which is the kind of stray folder that ends up committed.
const OUT = process.env.PREVIEW_OUT ?? join(dirname(fileURLToPath(import.meta.url)), '..', '.preview')
mkdirSync(OUT, { recursive: true })

const SHOTS = [
  ['home', '/', 1440, 1000, true],
  ['home-360', '/', 360, 800, true],
  ['home-phone', '/', 390, 900, true],
  ['home-dark', '/?theme=dark', 1440, 1000, true],
  ['pricing', '/pricing', 1440, 1000, true],
  ['compare', '/compare', 1440, 1000, true],
  ['tool-tax', '/tools/advance-tax-calculator', 1440, 1000, false],
  ['tool-gst', '/tools/gst-calculator', 1440, 1000, false],
  ['tool-tds-phone', '/tools/tds-calculator', 390, 900, false],
  ['contact', '/contact', 1440, 1000, false],
  ['refunds', '/refunds', 1440, 1000, false],
]

const browser = await chromium.launch()
const problems = []

for (const [name, path, width, height, fullPage] of SHOTS) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  page.on('console', (message) => message.type() === 'error' && problems.push(`${name}: ${message.text().slice(0, 200)}`))
  page.on('pageerror', (error) => problems.push(`${name} uncaught: ${error.message.slice(0, 200)}`))
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${name}: HTTP ${response.status()} ${response.url().slice(0, 120)}`)
  })

  // ?theme=dark is a preview affordance only; the real page follows the system
  // or a stored choice. Set before navigation so nothing renders light first.
  if (path.includes('theme=dark')) {
    await page.addInitScript(() => {
      try { localStorage.setItem('cd-theme', 'dark') } catch (e) {}
    })
  }
  await page.goto(BASE + path.replace('?theme=dark', ''), { waitUntil: 'networkidle', timeout: 60_000 })
  // Scroll the whole page so every `.reveal` has fired, then return to the top.
  // Without this a full-page screenshot catches most sections at opacity 0.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)

  // The page must never scroll sideways. It is the failure nobody notices on a
  // desktop and everybody notices on a phone.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (overflow > 1) problems.push(`${name}: page scrolls horizontally by ${overflow}px`)

  // On touch widths, anything you are meant to press has to be pressable. An
  // inline link inside a sentence is exempt; a link that is its own row is not.
  if (width <= 680) {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('a, button, summary, input, select')]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          if (!r.height || r.height >= 32) return false
          return getComputedStyle(el).display !== 'inline'
        })
        .map((el) => `${el.tagName}.${String(el.className).split(' ')[0] || '-'}`)
        .slice(0, 5)
    )
    if (small.length) problems.push(`${name}: tap targets under 32px: ${[...new Set(small)].join(', ')}`)
  }

  // Text on a filled accent surface has to be whatever --on-accent says, which
  // is white in one theme and near black in the other. Checked rather than
  // trusted, because this fault only ever shows in one theme at a time: an
  // inherited page colour that happens to match hides it in the other.
  const onAccent = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const accent = root.getPropertyValue('--accent').trim()
    const expected = root.getPropertyValue('--on-accent').trim()
    // Resolve both through the browser so hex and rgb() compare equal.
    const probe = document.createElement('span')
    document.body.append(probe)
    const asRgb = (value) => {
      probe.style.color = value
      return getComputedStyle(probe).color
    }
    const accentRgb = asRgb(accent)
    const expectedRgb = asRgb(expected)
    probe.remove()

    const out = []
    document.querySelectorAll('body *').forEach((el) => {
      if (getComputedStyle(el).backgroundColor !== accentRgb) return
      if (!el.getBoundingClientRect().width) return
      ;[el, ...el.querySelectorAll('*')].forEach((kid) => {
        const c = getComputedStyle(kid).color
        if (c !== expectedRgb && !c.startsWith(expectedRgb.replace(')', ''))) {
          out.push(`${String(el.className).split(' ')[0] || el.tagName} > ${kid.TagName || kid.tagName} = ${c}`)
        }
      })
    })
    return [...new Set(out)].slice(0, 4)
  })

  if (onAccent.length) problems.push(`${name}: wrong foreground on the accent: ${onAccent.join(', ')}`)

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
  console.log(`  ${OUT}/${name}.png`)
  await page.close()
}

await browser.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n  ${problems.join('\n  ')}` : '\nNo problems.')
