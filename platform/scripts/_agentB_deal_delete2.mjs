import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const EMAIL = 'demo@creatordesk.in'
const PASSWORD = 'CreatorDeskDemo!2026'
const OUT = join(process.cwd(), '..', 'screenshots')
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
const page = await context.newPage()
page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text().slice(0,300)) })
page.on('response', async (res) => {
  if (res.status() >= 400 && !res.url().includes('/_expo/')) {
    let body = ''
    try { body = (await res.text()).slice(0,300) } catch {}
    console.log('HTTP', res.status(), res.url().slice(0,160), body)
  }
})

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

await page.getByText('QA-Test Brand', { exact: true }).first().click()
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'More options for QA-Test Brand', exact: true }).click()
await page.waitForTimeout(800)
await page.getByText('Delete deal', { exact: true }).click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Delete', exact: true }).click()
await page.waitForTimeout(2000)
await page.screenshot({ path: join(OUT, 'agentB-deal-deleted.png'), fullPage: true })
console.log('deleted the QA test deal')

// verify gone after reload
await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
if (await page.getByText('Skip', { exact: true }).first().isVisible().catch(() => false)) {
  await page.getByText('Skip', { exact: true }).first().click()
  await page.waitForTimeout(1500)
}
const stillThere = await page.getByText('QA- test reel', { exact: false }).first().isVisible().catch(() => false)
console.log('QA test deal still visible after reload (should be false):', stillThere)
await browser.close()
