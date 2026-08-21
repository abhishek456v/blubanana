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

await page.goto('http://localhost:8081/help', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)

await page.getByRole('button', { name: 'Ask for a copy', exact: true }).click()
await page.waitForTimeout(1000)
await page.getByRole('button', { name: 'Send the request', exact: true }).click()
await page.waitForTimeout(2000)
await page.screenshot({ path: join(OUT, 'agentB-help-copy-sent.png'), fullPage: true })
console.log('sent copy request')

// reload and inspect state of the button / any recorded indicator
await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: join(OUT, 'agentB-help-copy-after-reload.png'), fullPage: true })

// Open "Ask for erasure" dialog to inspect copy WITHOUT sending
await page.getByRole('button', { name: 'Ask for erasure', exact: true }).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: join(OUT, 'agentB-help-erasure-dialog.png'), fullPage: true })
console.log('opened erasure dialog (not sending)')

await browser.close()
