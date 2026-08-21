import { chromium } from 'playwright'

const EMAIL = 'demo@creatordesk.in'
const PASSWORD = 'CreatorDeskDemo!2026'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
const page = await context.newPage()
await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 120000 })
await page.waitForTimeout(3000)
await page.getByPlaceholder('you@example.com').fill(EMAIL)
await page.getByPlaceholder('••••••••').first().fill(PASSWORD)
await page.getByRole('button', { name: 'Sign in', exact: true }).click()
await page.waitForTimeout(4000)
if (await page.getByText('Skip', { exact: true }).first().isVisible().catch(() => false)) {
  await page.getByText('Skip', { exact: true }).first().click()
  await page.waitForTimeout(2000)
}

// Dump all buttons with accessible names near top-right
const buttons = await page.getByRole('button').all()
console.log('BUTTON COUNT', buttons.length)
for (const b of buttons) {
  const name = await b.getAttribute('aria-label').catch(() => null)
  const text = await b.textContent().catch(() => null)
  const visible = await b.isVisible().catch(() => false)
  if (visible) console.log(JSON.stringify({ name, text: text?.slice(0,40) }))
}

await browser.close()
