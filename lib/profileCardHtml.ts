import type { ProfileCardData } from './profileCard'

// The shareable card as a two-sided A5 document (§8.11).
//
// HTML rather than a captured screenshot, and printed through the same
// expo-print path as the invoice. That keeps it sharp at any size, works
// identically on web and native, and adds no native dependency — a captured
// view would be raster, and a raster rate card emailed on to a brand's
// finance team is the one that looks amateur.
//
// The palette is the app's, taken from constants/design.ts rather than picked
// again here: this is the artefact a brand sees before it ever sees the
// product, and it should look like the same thing.

const INK = '#0B0B12'
const BLUE_STOPS = '#5E97FF 0%, #1D46E8 34%, #4340D4 62%, #A99BEE 100%'
const INK_STOPS = '#2A2A31 0%, #17171C 38%, #0E0E12 72%, #1A1A21 100%'

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

/** `1.2M`, `48.3K` — how a follower count is spoken, and it has to fit. */
function compactCount(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(1).replace(/\.0$/, '')}L`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

/** Initials, since there is no photo on the profile to use yet. */
function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function buildProfileCardHtml(data: ProfileCardData): string {
  const handles = data.handles.map((h) => `@${h.handle}`).join('  ·  ')

  const rateRows = data.rates
    .map(
      (rate) => `
      <div class="rate">
        <span class="rk">${esc(rate.label)}</span>
        <span class="rv">${inr(rate.typical)}</span>
      </div>`
    )
    .join('')

  // Sample size is stated once, for the card as a whole, rather than per line.
  // A brand does not need to audit each row; it needs to know the numbers come
  // from work that happened rather than from an aspiration.
  const sampleTotal = data.rates.reduce((sum, r) => sum + r.sampleSize, 0)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: 148mm 210mm; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    font-variant-numeric: tabular-nums;
    color: #FFFFFF;
  }

  .side {
    width: 148mm; height: 210mm;
    padding: 16mm 14mm;
    display: flex; flex-direction: column;
    position: relative; overflow: hidden;
    page-break-after: always;
  }
  .side:last-child { page-break-after: auto; }

  .front { background: linear-gradient(150deg, ${BLUE_STOPS}); }
  .back  { background: linear-gradient(150deg, ${INK_STOPS}); }

  /* The hairline that stops a gradient panel reading as printed-on. */
  .side::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: rgba(255,255,255,0.34);
  }

  .mono {
    width: 26mm; height: 26mm; border-radius: 50%;
    background: rgba(255,255,255,0.16);
    border: 1px solid rgba(255,255,255,0.28);
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 600; letter-spacing: -0.02em;
  }

  .name { font-size: 30px; font-weight: 700; letter-spacing: -0.028em; margin-top: 9mm; line-height: 1.1; }
  .niche { font-size: 12.5px; color: rgba(255,255,255,0.72); margin-top: 2.5mm; }
  .handles { font-size: 12.5px; color: rgba(255,255,255,0.88); margin-top: 1.5mm; }

  .spacer { flex: 1; }

  .stats { display: flex; gap: 10mm; }
  .stat .v { font-size: 27px; font-weight: 700; letter-spacing: -0.028em; line-height: 1; }
  .stat .l {
    font-size: 9px; text-transform: uppercase; letter-spacing: .15em;
    color: rgba(255,255,255,0.62); margin-top: 2mm;
  }

  .label {
    font-size: 9px; text-transform: uppercase; letter-spacing: .16em;
    color: rgba(255,255,255,0.52);
  }

  .rate {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 3.6mm 0;
    border-bottom: 1px solid rgba(255,255,255,0.12);
  }
  .rate:last-of-type { border-bottom: none; }
  .rk { font-size: 13.5px; color: rgba(255,255,255,0.86); }
  .rv { font-size: 17px; font-weight: 650; letter-spacing: -0.02em; }

  .note { font-size: 10px; color: rgba(255,255,255,0.5); line-height: 1.55; }
  .contact { font-size: 13px; color: rgba(255,255,255,0.9); line-height: 1.7; }

  .foot {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 9px; color: rgba(255,255,255,0.42);
    border-top: 1px solid rgba(255,255,255,0.12);
    padding-top: 4mm; margin-top: 6mm;
  }
</style>
</head>
<body>

  <div class="side front">
    <div class="mono">${esc(monogram(data.name))}</div>
    <div class="name">${esc(data.name)}</div>
    ${data.niche ? `<div class="niche">${esc(data.niche)}</div>` : ''}
    ${handles ? `<div class="handles">${esc(handles)}</div>` : ''}

    <div class="spacer"></div>

    <div class="stats">
      ${
        data.followers != null
          ? `<div class="stat"><div class="v">${compactCount(data.followers)}</div><div class="l">Followers</div></div>`
          : ''
      }
      ${
        data.engagementRate != null
          ? `<div class="stat"><div class="v">${(data.engagementRate * 100).toFixed(1)}%</div><div class="l">Engagement</div></div>`
          : ''
      }
      ${
        data.costPerView != null
          ? `<div class="stat"><div class="v">₹${data.costPerView.toFixed(2)}</div><div class="l">Cost per view</div></div>`
          : ''
      }
    </div>
  </div>

  <div class="side back">
    <div class="label">Rates</div>
    <div style="margin-top:5mm;">
      ${rateRows || '<div class="note">No rates yet — they appear here once deals are logged.</div>'}
    </div>

    <div class="spacer"></div>

    ${
      data.phone
        ? `<div class="label" style="margin-bottom:2.5mm;">Contact</div>
           <div class="contact">${esc(data.phone)}</div>`
        : ''
    }

    ${
      sampleTotal > 0
        ? `<div class="note" style="margin-top:6mm;">
             Every rate is the median of what has actually been charged across
             ${sampleTotal} past ${sampleTotal === 1 ? 'deliverable' : 'deliverables'}, not a list price.
           </div>`
        : ''
    }

    <div class="foot">
      <span>${
        data.statsAreLive
          ? `Figures refreshed ${data.statsAsOf ? esc(data.statsAsOf.slice(0, 10)) : 'automatically'}`
          : 'Reach figures entered by hand'
      }</span>
      <span>CreatorDesk</span>
    </div>
  </div>

</body>
</html>`.trim()
}
