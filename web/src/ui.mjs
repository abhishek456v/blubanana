// Section builders.
//
// Every page is assembled from these rather than from raw markup, so a heading
// rhythm or a card's padding is decided once. The rule the old site broke: if
// two sections have the same shape they should come from the same function,
// and if they should not look the same they should not be the same function.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'assets', 'manifest.json'), 'utf8'))

/** Escapes text destined for markup. Brand names contain & more often than you expect. */
export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * A responsive screenshot.
 *
 * Width and height come from the manifest the image tool writes, so the box is
 * reserved before the bytes arrive and nothing on the page jumps as it loads.
 * `sizes` is the honest declaration of how wide it will actually render — get
 * it wrong and the browser fetches the 2000px copy for a 400px slot.
 */
export function shot(name, alt, { sizes = '(max-width: 940px) 92vw, 900px', className = 'shot', lazy = true } = {}) {
  const set = MANIFEST[name]
  if (!set) throw new Error(`No image "${name}". Run: node web/tools/images.mjs`)
  const largest = set[set.length - 1]
  const srcset = set.map((v) => `${v.file} ${v.w}w`).join(', ')

  return `<div class="${className}">
    <img src="${set[0].file}" srcset="${srcset}" sizes="${sizes}" width="${largest.w}" height="${largest.h}"
         alt="${esc(alt)}" ${lazy ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'}>
  </div>`
}

export function section({ id, className = '', inner, container = true }) {
  const body = container ? `<div class="container">${inner}</div>` : inner
  return `<section${id ? ` id="${id}"` : ''} class="band ${className}">${body}</section>`
}

/** Eyebrow + heading + lede, the opening of most sections. */
export function head({ eyebrow, title, lede, align = 'left' }) {
  return `<div class="reveal" style="max-width:${align === 'center' ? '760px' : '780px'};${align === 'center' ? 'margin:0 auto;text-align:center;' : ''}">
    ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
    <h2>${title}</h2>
    ${lede ? `<p class="lede" style="margin-top:20px">${lede}</p>` : ''}
  </div>`
}

/** A checked list of specifics under a feature heading. */
export function points(items) {
  return `<ul class="points">${items
    .map(([bold, rest]) => `<li><span class="tick">✦</span><span><b>${bold}</b> ${rest}</span></li>`)
    .join('')}</ul>`
}

/**
 * The alternating feature row: art on one side, argument on the other.
 *
 * Flipping every other one is not decoration. Three identical left-image rows
 * read as a template; alternating them makes the page scroll like a document
 * someone laid out.
 */
export function split({ id, art, words, flip = false }) {
  return `<section${id ? ` id="${id}"` : ''} class="band band-line">
    <div class="container">
      <div class="split ${flip ? 'flip' : ''}">
        <div class="reveal">${art}</div>
        <div class="reveal">${words}</div>
      </div>
    </div>
  </section>`
}

/** Questions, as native <details> — no JavaScript, and findable with ⌘F. */
export function faq(items) {
  return `<div class="faq reveal">${items
    .map(([q, a]) => `<details><summary>${q}</summary><div class="answer">${a}</div></details>`)
    .join('')}</div>`
}

/** The structured-data twin of the block above, so answers can surface in search. */
export function faqSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({
      '@type': 'Question',
      name: q.replace(/<[^>]+>/g, ''),
      acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') },
    })),
  }
}

/** Tabbed screenshots. Progressive: with JS off, the first panel is simply the one shown. */
export function tabs(id, items) {
  const buttons = items
    .map(
      (item, i) =>
        `<button class="tab" role="tab" aria-selected="${i === 0}" aria-controls="${id}-p${i}" id="${id}-t${i}">${item.label}</button>`
    )
    .join('')
  const panels = items
    .map(
      (item, i) =>
        `<div class="panel" role="tabpanel" id="${id}-p${i}" aria-labelledby="${id}-t${i}"${i === 0 ? ' data-active' : ''}>
          <div class="split split-narrow">
            <div>${item.art}</div>
            <div><h3>${item.title}</h3><p class="dim" style="margin-top:14px;font-size:17px">${item.copy}</p>${item.extra ?? ''}</div>
          </div>
        </div>`
    )
    .join('')
  return `<div class="reveal"><div class="tabs" role="tablist" data-tabs="${id}">${buttons}</div>${panels}</div>`
}

export function closingCta({ title, sub, primary = 'Start free', href, secondary }) {
  return `<section class="close-cta">
    <div class="container reveal">
      <h2>${title}</h2>
      <p class="lede" style="margin:20px auto 0;max-width:560px">${sub}</p>
      <div class="btn-row">
        <a class="btn btn-lg" href="${href}">${primary}</a>
        ${secondary ? `<a class="btn btn-lg btn-ghost" href="${secondary[1]}">${secondary[0]}</a>` : ''}
      </div>
    </div>
  </section>`
}
