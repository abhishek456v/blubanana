import { chromium } from 'playwright'
const B = 'https://blubanana-website-eight.vercel.app'
const b = await chromium.launch()
const problems = []

for (const [name, w, dark] of [['desktop', 1440, false], ['dark', 1440, true], ['phone', 390, false]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, isMobile: w < 500 })
  if (dark) await p.addInitScript(() => { try { localStorage.setItem('cd-theme', 'dark') } catch (e) {} })
  p.on('console', (m) => m.type() === 'error' && problems.push(`${name} console: ${m.text().slice(0, 140)}`))
  p.on('pageerror', (e) => problems.push(`${name} uncaught: ${e.message.slice(0, 140)}`))
  p.on('response', (r) => { if (r.status() >= 400) problems.push(`${name}: HTTP ${r.status()} ${r.url().slice(0, 90)}`) })

  await p.goto(B, { waitUntil: 'networkidle', timeout: 45000 })
  await p.waitForTimeout(2500)

  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (over > 1) problems.push(`${name}: scrolls sideways by ${over}px`)

  if (name === 'desktop') {
    // is the price coming from the database, or the fallback compiled into the page
    const price = await p.evaluate(() => ({
      monthly: document.querySelector('[data-plan-total]')?.textContent?.trim(),
      offerChipShown: !document.querySelector('[data-intro-chip]')?.hidden,
      announceShown: !document.getElementById('announce')?.hidden,
    }))
    console.log('pricing on the page:', JSON.stringify(price))

    // and can the browser actually reach the two endpoints
    const live = await p.evaluate(async () => {
      const root = document.documentElement
      const h = { apikey: root.dataset.supabaseKey, Authorization: 'Bearer ' + root.dataset.supabaseKey }
      const seats = await fetch(root.dataset.supabaseUrl + '/rest/v1/rpc/intro_seats_taken', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' } })
      const price = await fetch(root.dataset.supabaseUrl + '/rest/v1/pricing?select=*&limit=1', { headers: h })
      return { seats: seats.status, seatsValue: await seats.text(), pricing: price.status, pricingRows: (await price.json()).length }
    })
    console.log('database from the browser:', JSON.stringify(live))
  }

  await p.close()
}
await b.close()
console.log(problems.length ? '\nPROBLEMS:\n  ' + [...new Set(problems)].join('\n  ') : '\nNo console errors, no failed requests, no sideways scroll.')
