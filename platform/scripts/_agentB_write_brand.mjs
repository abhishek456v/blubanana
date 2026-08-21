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

await page.getByRole('button', { name: 'Brands', exact: true }).click()
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Add brand', exact: true }).click()
await page.waitForTimeout(1000)

await page.getByPlaceholder('Nykaa').fill('QA-Test Brand')
await page.getByPlaceholder('Who you talk to').fill('QA Tester')
await page.getByPlaceholder('+91 98765 43210').fill('9998887770')
await page.getByPlaceholder('poc@brand.com').fill('qa-test@example.com')
await page.getByPlaceholder(/hook style/i).fill('QA-created record for automated testing. Safe to delete.')
await page.screenshot({ path: join(OUT, 'agentB-write-brand-filled.png'), fullPage: true })

await page.getByRole('button', { name: 'Add brand', exact: true }).last().click()
await page.waitForTimeout(2500)
await page.screenshot({ path: join(OUT, 'agentB-write-brand-after-submit.png'), fullPage: true })
console.log('submitted')

// Reload and check it persisted
await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.getByRole('button', { name: 'Brands', exact: true }).click()
await page.waitForTimeout(1500)
const found = await page.getByText('QA-Test Brand', { exact: false }).first().isVisible().catch(() => false)
console.log('QA-Test Brand visible after reload:', found)
await page.screenshot({ path: join(OUT, 'agentB-write-brand-after-reload.png'), fullPage: true })

await browser.close()
