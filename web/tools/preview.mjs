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

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:4173'
const OUT = process.env.PREVIEW_OUT ?? 'web/.preview'
mkdirSync(OUT, { recursive: true })

const SHOTS = [
  ['home', '/', 1440, 1000, true],
  ['home-phone', '/', 390, 900, true],
  ['pricing', '/pricing', 1440, 1000, true],
  ['pricing-phone', '/pricing', 390, 900, true],
  ['contact', '/contact', 1440, 1000, false],
  ['terms', '/terms', 1440, 1000, false],
  ['privacy', '/privacy', 1440, 1000, false],
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

  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60_000 })
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

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
  console.log(`  ${OUT}/${name}.png`)
  await page.close()
}

await browser.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n  ${problems.join('\n  ')}` : '\nNo problems.')
