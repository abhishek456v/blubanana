// Generates the app icon, Android adaptive icon, splash mark and web favicon.
//
// Run with: node scripts/generate-icons.mjs
//
// The mark is drawn as geometry rather than set in a typeface, deliberately:
// text in an SVG depends on whatever fonts the rasterising machine happens to
// have, so a lettered mark would render differently (or not at all) on another
// laptop or in CI. Two arcs are two arcs everywhere.
//
// Colours are the design tokens from constants/design.ts. If the accent or the
// page background changes there, change them here and re-run.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = join(ROOT, 'assets')

// These were still the pre-rename orange and brown, which is why the generated
// icons did not match anything else in the product.
const INK = '#050506' // Colors.dark.bgPage
const ACCENT = '#4169E1' // Colors.*.accent, royal blue

/**
 * The Blubanana mark: a banana, in royal blue.
 *
 * Same shape and same numbers as `components/ui/Mark.tsx`, which carries the
 * explanation. It replaced an open ring that read as a C, drawn back when the
 * product had a different name.
 *
 * @param size    canvas edge in px
 * @param scale   mark width as a fraction of the canvas
 * @param bg      background fill, or null for transparent
 */
function markSvg(size, scale, bg) {
  const d = 'M 25.54 86.19 A 43.56 43.56 0 0 0 89.89 32.20 A 63.13 63.13 0 0 1 25.54 86.19 Z'

  // Padding comes from widening the viewBox around the shape's measured
  // centre, not from scaling the geometry, so `scale` means exactly what it
  // says: the mark's width as a fraction of the canvas.
  const CENTRE = { x: 59.69, y: 63.05, width: 76.3 }
  const side = CENTRE.width / scale
  const vx = (CENTRE.x - side / 2).toFixed(2)
  const vy = (CENTRE.y - side / 2).toFixed(2)
  const s = side.toFixed(2)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vx} ${vy} ${s} ${s}">
  ${bg ? `<rect x="${vx}" y="${vy}" width="${s}" height="${s}" fill="${bg}"/>` : ''}
  <path d="${d}" fill="${ACCENT}" stroke="${ACCENT}" stroke-width="8" stroke-linejoin="round"/>
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
