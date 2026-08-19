// The social preview image.
//
//   node web/tools/og.mjs
//
// A page shared into a WhatsApp group without one shows a grey box, and this
// product will mostly be shared into WhatsApp groups. Rendered with Chromium
// rather than drawn by hand so it uses the site's own tokens and typeface, and
// so it can be regenerated when the wording changes.

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')
mkdirSync(OUT, { recursive: true })

const html = `<!DOCTYPE html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400..700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; background: #FFFFFF; color: #0B0B12;
    font-family: 'Google Sans Flex', system-ui, sans-serif;
    padding: 78px; display: flex; flex-direction: column; justify-content: space-between;
    background-image: radial-gradient(620px 420px at 88% 8%, #E8EEFF, transparent 68%);
  }
  .mark { display: flex; align-items: center; gap: 13px; font-size: 27px; font-weight: 600; letter-spacing: -.02em; }
  h1 { font-size: 68px; line-height: 1.06; letter-spacing: -.035em; font-weight: 700; max-width: 17ch; }
  p { font-size: 27px; color: #55555F; margin-top: 24px; }
  .foot { display: flex; gap: 12px; }
  .chip { padding: 11px 20px; border-radius: 999px; background: #F0F4FF; color: #2A57D8; font-size: 20px; font-weight: 500; }
</style></head><body>
  <div class="mark">
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none"><path d="M27 8.5A12.5 12.5 0 1 0 27 23.5" stroke="#3B6EF6" stroke-width="5" stroke-linecap="round"/></svg>
    CreatorDesk
  </div>
  <div>
    <h1>Brand deals, deadlines and payments. One app.</h1>
    <p>Made for Indian creators.</p>
  </div>
  <div class="foot">
    <span class="chip">Log a deal in 30 seconds</span>
    <span class="chip">Never miss a deadline</span>
    <span class="chip">Get paid on time</span>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.screenshot({ path: join(OUT, 'og.png') })
await browser.close()
console.log('web/assets/og.png')
