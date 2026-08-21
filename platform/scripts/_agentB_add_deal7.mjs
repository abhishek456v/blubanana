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

await page.getByRole('button', { name: 'Add deal', exact: true }).click()
await page.waitForTimeout(1200)
await page.getByText('QA-Test Brand', { exact: true }).click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Reel', exact: true }).click()
await page.getByPlaceholder('1 Reel + 3 Stories').fill('QA- test reel, safe to delete')
await page.getByPlaceholder('0').first().fill('1000')

await page.mouse.move(1000, 700)
let found = 0
for (let i = 0; i < 15; i++) {
  await page.mouse.wheel(0, 700)
  await page.waitForTimeout(300)
  found = await page.getByRole('button', { name: 'Save deal', exact: true }).count()
  if (found > 0) { console.log('found after', i, 'scrolls'); break }
}
await page.screenshot({ path: join(OUT, 'agentB-add-deal-prescroll2.png'), fullPage: true })
console.log('Save deal button count:', found)

if (found > 0) {
  await page.getByRole('button', { name: 'Save deal', exact: true }).click({ timeout: 10000 })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: join(OUT, 'agentB-add-deal-after-save.png'), fullPage: true })
  console.log('saved deal')
}

await browser.close()
