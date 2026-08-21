import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const EMAIL = 'demo@creatordesk.in'
const PASSWORD = 'CreatorDeskDemo!2026'
const OUT = join(process.cwd(), '..', 'screenshots')
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 1.5 })
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

await page.getByRole('button', { name: 'Add deal', exact: true }).click()
await page.waitForTimeout(1200)
await page.getByText('QA-Test Brand', { exact: true }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: join(OUT, 'agentB-add-deal-full.png'), fullPage: true })
console.log('full page shot done')
await browser.close()
