import type { Creator, Invoice, InvoiceLineItem } from '@/types'

// Printable HTML for an invoice, fed to expo-print (see lib/invoicePdf.ts).
// Plain inline-styled HTML with no external stylesheet or webfont, because
// expo-print renders this in an isolated context with no network.
//
// This document is the most formal thing the product produces: it goes to a
// brand's finance team, and it is the creator's evidence if a payment is ever
// disputed. It is worth more care than a screen.

/**
 * Escapes text before it goes into the template.
 *
 * Not paranoia: a brand called "Bath & Body" silently produced invalid markup
 * in the previous version, and any brand name or note containing < or & could
 * break the layout of a document the creator has already sent.
 */
function esc(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Spelled out in full for the two dates that carry legal weight. `month:
// 'short'` renders September as "Sept" against August's "Aug", and a document
// that may be read beside a purchase order should not abbreviate unevenly.
function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const tens = TENS[Math.floor(n / 10)]
  const ones = ONES[n % 10]
  return ones ? `${tens} ${ones}` : tens
}

/**
 * "Forty Seven Thousand Two Hundred Rupees Only": the amount in words.
 *
 * Standard practice on an Indian invoice, and the line a finance team checks
 * the figures against. Uses the Indian grouping (crore / lakh / thousand)
 * rather than millions.
 */
export function amountInWords(amount: number): string {
  const n = Math.round(Math.abs(amount))
  if (n === 0) return 'Zero Rupees Only'

  const parts: string[] = []
  const crore = Math.floor(n / 10_000_000)
  const lakh = Math.floor((n % 10_000_000) / 100_000)
  const thousand = Math.floor((n % 100_000) / 1_000)
  const hundred = Math.floor((n % 1_000) / 100)
  const rest = n % 100

  if (crore) parts.push(`${twoDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (hundred) parts.push(`${ONES[hundred]} Hundred`)

  // Indian invoice convention puts "and" before the trailing tens/units when
  // anything precedes them: "One Lakh Fifty Thousand and Ten".
  if (rest) parts.push(parts.length > 0 ? `and ${twoDigits(rest)}` : twoDigits(rest))

  return `${parts.join(' ')} ${n === 1 ? 'Rupee' : 'Rupees'} Only`
}

/** The CreatorDesk mark, as inline SVG so the PDF needs no image asset. */
function markSvg(size: number, color: string): string {
  const c = size / 2
  const r = size / 2 - size * 0.11
  const gap = (40 * Math.PI) / 180
  const x = (c + r * Math.cos(gap)).toFixed(2)
  const yTop = (c - r * Math.sin(gap)).toFixed(2)
  const yBottom = (c + r * Math.sin(gap)).toFixed(2)
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><path d="M ${x} ${yTop} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${x} ${yBottom}" fill="none" stroke="${color}" stroke-width="${(size * 0.16).toFixed(2)}" stroke-linecap="round"/></svg>`
}

export function buildInvoiceHtml(
  invoice: Invoice,
  creator: Creator,
  lineItems: InvoiceLineItem[] = []
): string {
  // Pre-migration-008 invoices have no line items; fall back to the single
  // description/amount pair so old invoices still render correctly.
  const items: InvoiceLineItem[] =
    lineItems.length > 0
      ? lineItems
      : [
          {
            id: 'legacy',
            workspace_id: invoice.workspace_id,
            invoice_id: invoice.id,
            deal_id: invoice.deal_id,
            description: invoice.description,
            hsn_sac: '998397',
            quantity: 1,
            unit_amount: invoice.amount,
            amount: invoice.amount,
            sort_order: 0,
            created_at: invoice.created_at,
          },
        ]

  const tds = invoice.tds_deducted ? (invoice.tds_amount ?? 0) : 0
  const netPayable = invoice.total_amount - tds

  const paymentRows = [
    creator.upi_id ? ['UPI', creator.upi_id] : null,
    creator.bank_account_number ? ['Account', creator.bank_account_number] : null,
    creator.ifsc_code ? ['IFSC', creator.ifsc_code] : null,
  ].filter(Boolean) as string[][]

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #17130F; margin: 0; padding: 58px 54px 40px;
    -webkit-font-smoothing: antialiased; font-size: 12.5px; line-height: 1.5;
    /* Every figure on this page sits in a column that has to line up. */
    font-variant-numeric: tabular-nums;
  }

  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .who { display: flex; align-items: center; gap: 8px; }
  .who .name { font-size: 15px; font-weight: 600; letter-spacing: -0.005em; }
  .from { font-size: 11px; color: #78706A; line-height: 1.65; margin-top: 7px; }
  .doc { text-align: right; }
  .doc .kind { font-size: 9.5px; text-transform: uppercase; letter-spacing: .16em; color: #A29A92; }
  .doc .number { font-size: 13px; font-weight: 600; margin-top: 3px; }

  .due { margin: 40px 0 36px; }
  .due .amount { font-size: 34px; font-weight: 700; letter-spacing: -0.028em; line-height: 1.05; }
  .due .when { font-size: 12px; color: #78706A; margin-top: 8px; }

  .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: .14em; color: #A29A92; }
  .billed { margin-bottom: 32px; }
  .billed .name { font-size: 13.5px; font-weight: 600; margin-top: 7px; }
  .billed .detail { font-size: 11.5px; color: #78706A; margin-top: 3px; line-height: 1.55; }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .14em;
       color: #A29A92; padding: 0 0 9px; border-bottom: 1px solid #17130F; font-weight: 600; }
  td { padding: 12px 0; font-size: 12.5px; border-bottom: 1px solid #EDE8E1; vertical-align: top; }
  th.r, td.r { text-align: right; }
  .desc { font-weight: 500; }
  .sac { font-size: 10px; color: #A29A92; margin-top: 3px; }

  .totals { margin-top: 18px; display: flex; justify-content: flex-end; }
  .totals-inner { width: 296px; }
  .trow { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #78706A; }
  .trow .v { color: #17130F; }
  .trow.sum { border-top: 1px solid #17130F; margin-top: 9px; padding-top: 13px;
              font-size: 14px; font-weight: 600; color: #17130F; }

  .words { margin-top: 28px; font-size: 11.5px; color: #78706A; }
  .words b { color: #17130F; font-weight: 600; }

  .lower { display: flex; gap: 44px; margin-top: 36px; }
  .col { flex: 1; }
  .col .label { margin-bottom: 8px; }
  .kv { display: flex; font-size: 11.5px; padding: 3px 0; }
  .kv .k { width: 58px; color: #A29A92; }
  .kv .v { color: #17130F; }
  .note { font-size: 11.5px; color: #78706A; line-height: 1.65; }

  .foot { margin-top: 46px; padding-top: 13px; border-top: 1px solid #EDE8E1;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 9.5px; color: #A29A92; }
  .foot .mark { display: flex; align-items: center; gap: 5px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="who">
        ${markSvg(17, '#E09612')}
        <span class="name">${esc(creator.name)}</span>
      </div>
      <div class="from">
        Content creator${creator.phone ? `<br/>${esc(creator.phone)}` : ''}${creator.gstin ? `<br/>GSTIN ${esc(creator.gstin)}` : ''}
      </div>
    </div>
    <div class="doc">
      <div class="kind">${invoice.gst_applicable ? 'Tax invoice' : 'Invoice'}</div>
      <div class="number">${esc(invoice.invoice_number)}</div>
    </div>
  </div>

  ${/*
    The figure the reader opened this document to find, stated once and set
    large. A finance team scanning a stack of invoices is looking for what to
    pay and by when; everything below is the evidence for it. Previously this
    sat at the bottom of a totals column at 16px, a single step above body
    text, so the page had no focal point at all.
  */ ''}
  <div class="due">
    <div class="amount">${formatINR(netPayable)}</div>
    <div class="when">
      ${
        invoice.payment_due_date
          ? `Due ${formatDateLong(invoice.payment_due_date)}`
          : 'Due on receipt'
      } &nbsp;·&nbsp; Issued ${formatDateLong(invoice.invoice_date)}
    </div>
  </div>

  <div class="billed">
    <div class="label">Billed to</div>
    <div class="name">${esc(invoice.brand_name)}</div>
    ${
      invoice.brand_contact_person || invoice.brand_contact_email
        ? `<div class="detail">${[esc(invoice.brand_contact_person), esc(invoice.brand_contact_email)].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>`
        : ''
    }
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="r">Qty</th>
        <th class="r">Rate</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item) => `<tr>
        <td>
          <div class="desc">${esc(item.description)}</div>
          <div class="sac">SAC ${esc(item.hsn_sac)}</div>
        </td>
        <td class="r">${item.quantity}</td>
        <td class="r">${formatINR(item.unit_amount)}</td>
        <td class="r">${formatINR(item.amount)}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-inner">
      ${
        // With no tax and no deduction the subtotal is the total, and printing
        // the same figure twice reads as a mistake rather than as arithmetic.
        invoice.gst_applicable || tds > 0
          ? `<div class="trow"><span>Subtotal</span><span class="v">${formatINR(invoice.amount)}</span></div>`
          : ''
      }
      ${
        invoice.gst_applicable
          ? `<div class="trow"><span>GST @ ${invoice.gst_rate}%</span><span class="v">${formatINR(invoice.gst_amount)}</span></div>
             <div class="trow"><span>Invoice total</span><span class="v">${formatINR(invoice.total_amount)}</span></div>`
          : ''
      }
      ${
        // Neutral, not red. TDS is a statutory deduction the brand is required
        // to make, not a problem with the invoice, and colouring it like an
        // error invites a finance team to query a line that is simply correct.
        tds > 0
          ? `<div class="trow"><span>Less TDS withheld</span><span class="v">− ${formatINR(tds)}</span></div>`
          : ''
      }
      <div class="trow sum"><span>Amount due</span><span class="v">${formatINR(netPayable)}</span></div>
    </div>
  </div>

  ${/*
    Required on an Indian invoice, and the line a finance team reconciles the
    figures against, but it is a check rather than a headline: set as a plain
    sentence instead of the tinted, accent-barred callout it used to be.
  */ ''}
  <div class="words">Amount in words: <b>${amountInWords(netPayable)}</b></div>

  <div class="lower">
    ${
      paymentRows.length > 0
        ? `<div class="col">
            <div class="label">Payment details</div>
            ${paymentRows
              .map((row) => `<div class="kv"><span class="k">${row[0]}</span><span class="v">${esc(row[1])}</span></div>`)
              .join('')}
          </div>`
        : ''
    }
    ${
      invoice.notes
        ? `<div class="col"><div class="label">Notes</div><div class="note">${esc(invoice.notes)}</div></div>`
        : ''
    }
  </div>

  ${
    // Only a registered creator may charge GST. Saying so explicitly stops a
    // finance team assuming tax was forgotten and holding up the payment.
    !invoice.gst_applicable
      ? `<div class="note" style="margin-top:18px;">GST not applicable${creator.gstin ? '' : ' (not GST registered)'}.</div>`
      : ''
  }

  <div class="foot">
    <span>This is a computer-generated invoice and does not require a signature.</span>
    <span class="mark">${markSvg(11, '#9A9186')} CreatorDesk</span>
  </div>
</body>
</html>`.trim()
}
