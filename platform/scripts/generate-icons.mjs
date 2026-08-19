// Generates the app icon, Android adaptive icon, splash mark and web favicon.
//
// Run with: node scripts/generate-icons.mjs
//
// The mark is drawn as geometry rather than set in Syne, deliberately: text in
// an SVG depends on whatever fonts the rasterising machine happens to have, so
// a lettered mark would render differently (or not at all) on another laptop or
// in CI. An arc is an arc everywhere.
//
// Colours are the design tokens from constants/design.ts. If the accent or the
// page background changes there, change them here and re-run.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = join(ROOT, 'assets')

const INK = '#141210' // Colors.dark.bgPage
const ACCENT = '#F5A623' // Colors.*.accent

/**
 * The CreatorDesk mark: an open ring, cut on the right.
 *
 * Reads as a C, but the opening is the point: this is a product about a
 * business loop that never quite closes on its own. Round caps and a heavy
 * stroke keep it legible down to a 16px favicon, where a thin or fussy mark
 * turns to mush.
 *
 * @param size    canvas edge in px
 * @param scale   mark diameter as a fraction of the canvas
 * @param bg      background fill, or null for transparent
 */
function markSvg(size, scale, bg) {
  const center = size / 2
  const radius = (size * scale) / 2
  const stroke = radius * 0.39

  // Gap centred on the right, 80° wide: the arc runs from +40° to −40° the
  // long way round. y is negated because SVG's y axis points down.
  const gapHalf = (40 * Math.PI) / 180
  const x = center + radius * Math.cos(gapHalf)
  const yTop = center - radius * Math.sin(gapHalf)
  const yBottom = center + radius * Math.sin(gapHalf)

  const round = (n) => Number(n.toFixed(2))
  // large-arc-flag=1 (we take the long way), sweep-flag=0 (anticlockwise on
  // screen, so the opening stays on the right).
  const arc = `M ${round(x)} ${round(yTop)} A ${round(radius)} ${round(radius)} 0 1 0 ${round(x)} ${round(yBottom)}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
  <path d="${arc}" fill="none" stroke="${ACCENT}" stroke-width="${round(stroke)}" stroke-linecap="round"/>
</svg>`
}

const TARGETS = [
  // Full-bleed. iOS applies its own corner mask and rejects transparency.
  { file: 'icon.png', size: 1024, scale: 0.58, bg: INK },
  // Android crops to a circle and animates within it, so the mark sits inside
  // the ~66% safe zone and the background colour comes from app.json.
  { file: 'adaptive-icon.png', size: 1024, scale: 0.42, bg: null },
  // Splash draws on a solid colour set in the plugin config.
  { file: 'splash-icon.png', size: 512, scale: 0.5, bg: null },
  // Browser tabs render this at 16px; a slightly heavier mark survives that.
  { file: 'favicon.png', size: 96, scale: 0.66, bg: INK },
]

await mkdir(ASSETS, { recursive: true })

for (const { file, size, scale, bg } of TARGETS) {
  const svg = markSvg(size, scale, bg)
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
  await writeFile(join(ASSETS, file), png)
  console.log(`${file.padEnd(20)} ${size}x${size}  ${png.length.toLocaleString()} bytes`)
}

// Kept alongside the PNGs so the mark can be re-cut at any size, or dropped
// into the public profile card, without re-deriving the geometry.
await writeFile(join(ASSETS, 'mark.svg'), markSvg(512, 0.58, INK))
console.log('mark.svg             vector source')
