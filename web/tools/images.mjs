// Turns raw app screenshots into the web's image set.
//
//   node web/tools/images.mjs
//
// The screenshots in /screenshots are 2880px wide and up to 2.5MB each,
// because they exist to be inspected. Shipping those to a phone on Indian
// mobile data would make a site that looks better than the old one but feels
// considerably worse, which is a bad trade.
//
// There is no cwebp, ImageMagick or Pillow on this machine and none of them is
// worth adding as a dependency for ten images. Chromium is already here for
// Playwright, and it has a WebP encoder built in — so this drives a canvas and
// reads the encoded bytes back out. Same result, nothing new installed.
//
// Output is committed. The site must build without a browser present.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHOTS = join(ROOT, 'screenshots')
const OUT = join(ROOT, 'web', 'assets')

/**
 * What the site actually uses.
 *
 * `crop` is fractional [x, y, w, h] of the source, so it survives a re-capture
 * at a different device scale — which a pixel rectangle would not. It exists
 * for the screens the app draws as a centred sheet, where three-fifths of the
 * frame is empty page around the thing worth showing.
 */
const IMAGES = [
  { out: 'home-desktop',    src: 'demo-wide-02-home.png',        widths: [1400, 2000] },
  { out: 'home-phone',      src: 'demo-phone-02-home.png',       widths: [430, 860] },
  { out: 'money-desktop',   src: 'demo-wide-04-money.png',       widths: [1200, 1800] },
  { out: 'money-phone',     src: 'demo-phone-04-money.png',      widths: [430, 860] },
  { out: 'work-desktop',    src: 'demo-wide-03-work.png',        widths: [1200, 1800] },
  { out: 'brands-desktop',  src: 'demo-wide-05-brands.png',      widths: [1200, 1800] },
  { out: 'you-desktop',     src: 'demo-wide-06-you.png',         widths: [1200, 1800] },
  { out: 'newdeal',         src: 'demo-wide-07-deal-new.png',    widths: [1000, 1500], crop: [0.26, 0.06, 0.48, 0.90] },
  { out: 'tax',             src: 'demo-wide-07-tax.png',         widths: [900, 1400],  crop: [0.30, 0.13, 0.40, 0.84] },
  { out: 'expenses',        src: 'demo-wide-07-expenses.png',    widths: [900, 1400],  crop: [0.30, 0.13, 0.40, 0.84] },
  { out: 'annual-report',   src: 'demo-wide-07-annual-report.png', widths: [900, 1400], crop: [0.30, 0.10, 0.40, 0.86] },
  { out: 'ratecard',        src: 'demo-wide-07-profile-card.png', widths: [1000, 1500], crop: [0.30, 0.09, 0.40, 0.82] },
  { out: 'signin',          src: 'demo-wide-01-landing.png',     widths: [1200, 1800] },
]

// A deal detail shot is named after whichever deal was open, so it is matched
// by prefix rather than named outright.
const { readdirSync } = await import('node:fs')
const dealShot = readdirSync(SHOTS).find((f) => f.startsWith('demo-wide-07-deal-') && f !== 'demo-wide-07-deal-new.png')
if (dealShot) IMAGES.push({ out: 'deal-desktop', src: dealShot, widths: [1200, 1800] })

const invoiceShot = readdirSync(SHOTS).find((f) => f.startsWith('demo-wide-07-invoice-'))
if (invoiceShot) IMAGES.push({ out: 'invoice', src: invoiceShot, widths: [900, 1400], crop: [0.30, 0.14, 0.40, 0.72] })

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
// about:blank has no origin, and a canvas needs one before it will hand back
// image data. A data: document gives it one without touching the network.
await page.setContent('<canvas id="c"></canvas>')

// The manifest is what lets the site emit width and height on every <img>
// without a human copying numbers across: no layout shift, and no chance of a
// stale dimension after a re-crop.
const manifest = {}

let total = 0
for (const image of IMAGES) {
  manifest[image.out] = []
  const source = `data:image/png;base64,${readFileSync(join(SHOTS, image.src)).toString('base64')}`

  for (const width of image.widths) {
    const encoded = await page.evaluate(
      async ({ source, width, crop }) => {
        const img = new Image()
        img.src = source
        await img.decode()

        const [cx, cy, cw, ch] = crop ?? [0, 0, 1, 1]
        const sx = Math.round(img.width * cx)
        const sy = Math.round(img.height * cy)
        const sw = Math.round(img.width * cw)
        const sh = Math.round(img.height * ch)

        const canvas = document.getElementById('c')
        canvas.width = width
        canvas.height = Math.round((sh / sw) * width)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        // 0.82 is where a dark interface screenshot stops shedding bytes and
        // starts shedding the edges of small type.
        return { data: canvas.toDataURL('image/webp', 0.82), w: canvas.width, h: canvas.height }
      },
      { source, width, crop: image.crop ?? null }
    )

    const bytes = Buffer.from(encoded.data.split(',')[1], 'base64')
    const name = `${image.out}-${width}.webp`
    writeFileSync(join(OUT, name), bytes)
    manifest[image.out].push({ file: `/assets/${name}`, w: encoded.w, h: encoded.h })
    total += bytes.length
    console.log(`  ${name.padEnd(28)} ${encoded.w}×${encoded.h}  ${(bytes.length / 1024).toFixed(0)}KB`)
  }
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))

await browser.close()
console.log(`\n${(total / 1024 / 1024).toFixed(2)}MB across ${IMAGES.reduce((n, i) => n + i.widths.length, 0)} files`)
