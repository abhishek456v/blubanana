import { chromium } from 'playwright'
const B = 'https://blubanana-platform.vercel.app'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
const failed = []
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)))
p.on('pageerror', (e) => errors.push('uncaught: ' + e.message.slice(0, 160)))
p.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(/\?.*/, '').slice(0, 100)}`) })

await p.goto(B + '/sign-in', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(4000)

const seen = await p.evaluate(() => document.body.innerText.slice(0, 400))
console.log('what a visitor sees on /sign-in:\n' + seen.split('\n').filter(Boolean).slice(0, 8).map((l) => '  ' + l).join('\n'))
console.log('\nvisible error toast:', /could not|failed|error/i.test(seen) ? 'YES' : 'no')

// does a refresh deep in the app stay put
await p.goto(B + '/money', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(3000)
console.log('after loading /money directly, the URL is:', p.url())

await p.screenshot({ path: '/private/tmp/claude-501/-Users-abhishek456v-Projects-crm-app/1986f8df-ddd9-4021-9fbd-da62981fc9ee/scratchpad/shots/live-app.png' })
console.log('\nconsole errors:', errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : 'none')
console.log('failed requests:', failed.length ? '\n  ' + [...new Set(failed)].join('\n  ') : 'none')
await b.close()
