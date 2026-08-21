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
await page.getByRole('button', { name: /View all/, exact: false }).click()
await page.waitForTimeout(1200)
await page.getByText('QA-Test Brand', { exact: true }).first().click()
await page.waitForTimeout(1200)
await page.screenshot({ path: join(OUT, 'agentB-brand-detail.png'), fullPage: true })

const buttons = await page.getByRole('button').all()
for (const b of buttons) {
  const name = await b.getAttribute('aria-label').catch(() => null)
  const text = await b.textContent().catch(() => null)
  const visible = await b.isVisible().catch(() => false)
  if (visible) console.log('BTN:', JSON.stringify({ name, text: text?.slice(0,40) }))
}
await browser.close()
