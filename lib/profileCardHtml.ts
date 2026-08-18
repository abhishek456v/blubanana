import { cssStops, type CardTheme } from '@/constants/cardThemes'

// The shareable card as a two-sided A5 document (§8.11).
//
// ── Why the content model is strings ────────────────────────────────────────
//
// Everything on the card is editable before it is sent, so the builder takes
// finished display text rather than raw figures. The form edits exactly what
// appears — including the labels and the paragraph — instead of editing inputs
// that a formatter then reinterprets. It also means "₹29,500" and "₹29.5K" and
// "from ₹25,000" are all just things she can type, which is the difference
// between a card she can send and a card she has to accept.
//
// The derived values live in `profileCard.ts`; `toCardContent()` there turns
// them into this. Nothing in here computes anything.

export interface CardRateLine {
  label: string
  value: string
}

export interface CardStat {
  label: string
  value: string
}

export interface CardContent {
  name: string
  /** One line under the name — niche, positioning, whatever she wants. */
  tagline: string
  handles: string
  stats: CardStat[]
  ratesHeading: string
  rates: CardRateLine[]
  /** The paragraph on the back. Empty string omits the block entirely. */
  about: string
  contactHeading: string
  contact: string
  /** Small print along the bottom of the back. */
  footnote: string
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Initials, for when there is no photo to show. */
function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export interface BuildCardOptions {
  content: CardContent
  theme: CardTheme
  /**
   * The creator's photo as a `data:` URI.
   *
   * A data URI, not a URL: the document is rendered to a PDF that has to keep
   * working offline, in print, and on a brand's machine that has never
   * authenticated against our storage bucket. A remote image would resolve to
   * a broken box in exactly the place a face belongs.
   */
  photoDataUri?: string | null
}

export function buildProfileCardHtml({
  content,
  theme,
  photoDataUri,
}: BuildCardOptions): string {
  const stats = content.stats
    .filter((s) => s.value.trim())
    .map(
      (s) => `
        <div class="stat">
          <div class="sv">${esc(s.value)}</div>
          <div class="sl">${esc(s.label)}</div>
        </div>`
    )
    .join('')

  const rates = content.rates
    .filter((r) => r.label.trim() || r.value.trim())
    .map(
      (r) => `
        <div class="rate">
          <span class="rk">${esc(r.label)}</span>
          <span class="rv">${esc(r.value)}</span>
        </div>`
    )
    .join('')

  const portrait = photoDataUri
    ? `<div class="portrait"><img src="${photoDataUri}" alt="" /></div>`
    : `<div class="portrait mono">${esc(monogram(content.name))}</div>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: 148mm 210mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    font-variant-numeric: tabular-nums;
    color: ${theme.ink};
  }

  .side {
    width: 148mm; height: 210mm;
    padding: 14mm 13mm 12mm;
    display: flex; flex-direction: column;
    position: relative; overflow: hidden;
    page-break-after: always;
  }
  .side:last-child { page-break-after: auto; }

  /* The motif sits over the gradient and under everything else. Painted with a
     pseudo-element so the panel keeps one background-image slot for the
     gradient itself, which some print engines handle better than a stack. */
  .side::after {
    content: ''; position: absolute; inset: 0;
    background: ${theme.motif};
    pointer-events: none;
  }
  .side > * { position: relative; z-index: 1; }

  .front { background: linear-gradient(150deg, ${cssStops(theme.front)}); }
  .back  { background: linear-gradient(150deg, ${cssStops(theme.back)}); }

  /* A hard-cut gradient edge reads as printed-on; one brighter hairline along
     the top is what makes it read as a surface. */
  .side::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: rgba(255,255,255,0.34); z-index: 2;
  }

  .portrait {
    width: 46mm; height: 46mm; border-radius: 50%;
    overflow: hidden; flex: 0 0 auto;
    border: 1.5px solid rgba(255,255,255,0.42);
    background: rgba(255,255,255,0.12);
  }
  .portrait img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .portrait.mono {
    display: flex; align-items: center; justify-content: center;
    font-size: 42px; font-weight: 600; letter-spacing: -0.02em;
  }

  .name {
    font-size: 34px; font-weight: 700; letter-spacing: -0.03em;
    line-height: 1.05; margin-top: 10mm;
  }
  .tagline { font-size: 13px; color: ${theme.inkSoft}; margin-top: 3mm; line-height: 1.5; }
  .handles { font-size: 12.5px; opacity: 0.9; margin-top: 2mm; }

  .spacer { flex: 1; }

  .stats { display: flex; flex-wrap: wrap; gap: 9mm; }
  .sv { font-size: 26px; font-weight: 700; letter-spacing: -0.028em; line-height: 1; }
  .sl {
    font-size: 8.5px; text-transform: uppercase; letter-spacing: .16em;
    color: ${theme.inkSoft}; margin-top: 2mm;
  }

  .label {
    font-size: 8.5px; text-transform: uppercase; letter-spacing: .17em;
    color: ${theme.inkSoft};
  }

  .rate {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 3.4mm 0;
    border-bottom: 1px solid rgba(255,255,255,0.13);
  }
  .rate:last-of-type { border-bottom: none; }
  .rk { font-size: 13.5px; opacity: 0.88; }
  .rv { font-size: 17.5px; font-weight: 650; letter-spacing: -0.02em; }

  .about { font-size: 12px; line-height: 1.65; color: ${theme.inkSoft}; }
  .contact { font-size: 13.5px; line-height: 1.7; opacity: 0.94; }

  .foot {
    font-size: 8.5px; color: ${theme.inkSoft};
    border-top: 1px solid rgba(255,255,255,0.13);
    padding-top: 4mm; margin-top: 6mm;
    display: flex; justify-content: space-between; align-items: center;
  }
</style>
</head>
<body>

  <div class="side front">
    ${portrait}
    <div class="name">${esc(content.name)}</div>
    ${content.tagline.trim() ? `<div class="tagline">${esc(content.tagline)}</div>` : ''}
    ${content.handles.trim() ? `<div class="handles">${esc(content.handles)}</div>` : ''}
    <div class="spacer"></div>
    ${stats ? `<div class="stats">${stats}</div>` : ''}
  </div>

  <div class="side back">
    ${
      rates
        ? `<div class="label">${esc(content.ratesHeading)}</div>
           <div style="margin-top:5mm;">${rates}</div>`
        : ''
    }

    <div class="spacer"></div>

    ${content.about.trim() ? `<div class="about">${esc(content.about)}</div>` : ''}

    ${
      content.contact.trim()
        ? `<div class="label" style="margin-top:7mm;">${esc(content.contactHeading)}</div>
           <div class="contact" style="margin-top:2.5mm;">${esc(content.contact)}</div>`
        : ''
    }

    <div class="foot">
      <span>${esc(content.footnote)}</span>
      <span>CreatorDesk</span>
    </div>
  </div>

</body>
</html>`.trim()
}
