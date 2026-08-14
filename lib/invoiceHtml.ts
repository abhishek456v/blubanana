import type { Creator, Invoice, InvoiceLineItem } from '@/types'

// Printable HTML for an invoice, fed to expo-print (see lib/invoicePdf.ts).
// Plain inline-styled HTML with no external stylesheet or webfont, because
// expo-print renders this in an isolated context with no network.
//
// This document is the most formal thing the product produces — it goes to a
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

function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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
 * "Forty Seven Thousand Two Hundred Rupees Only" — the amount in words.
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
    color: #1C1815; margin: 0; padding: 44px 40px 36px;
    -webkit-font-smoothing: antialiased; font-size: 13px; line-height: 1.5;
  }
  .rule { height: 3px; background: #F5A623; margin-bottom: 26px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
  .brandline { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
  .creator-name { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
  .from { font-size: 11.5px; color: #6B6259; line-height: 1.65; }
  .doc { text-align: right; }
  .doc .kind { font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: #9A9186; }
  .doc .number { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; margin-top: 2px; }
  .doc .meta { font-size: 11.5px; color: #6B6259; margin-top: 5px; line-height: 1.6; }
  .parties { display: flex; gap: 12px; margin-bottom: 24px; }
  .party { flex: 1; background: #F6F2EC; border-radius: 9px; padding: 13px 15px; }
  .party .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: .12em; color: #9A9186; margin-bottom: 5px; }
  .party .name { font-size: 14px; font-weight: 600; }
  .party .detail { font-size: 11.5px; color: #6B6259; margin-top: 3px; line-height: 1.55; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .1em;
       color: #9A9186; padding: 0 0 8px; border-bottom: 1.5px solid #1C1815; font-weight: 600; }
  td { padding: 11px 0; font-size: 12.5px; border-bottom: 1px solid #EAE4DA; vertical-align: top; }
  th.r, td.r { text-align: right; }
  th.c, td.c { text-align: center; }
  .desc { font-weight: 500; }
  .hsn { font-size: 10.5px; color: #9A9186; margin-top: 2px; }
  .totals { margin-top: 14px; display: flex; justify-content: flex-end; }
  .totals-inner { width: 62%; }
  .trow { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12.5px; color: #6B6259; }
  .trow.net { border-top: 1.5px solid #1C1815; margin-top: 7px; padding-top: 11px;
              font-size: 16px; font-weight: 700; color: #1C1815; }
  .trow.tds { color: #C0392B; }
  .words { margin-top: 18px; background: #FBF8F3; border-left: 3px solid #F5A623;
           padding: 11px 14px; border-radius: 0 7px 7px 0; }
  .words .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: .12em; color: #9A9186; }
  .words .value { font-size: 12.5px; font-weight: 600; margin-top: 2px; }
  .lower { display: flex; gap: 12px; margin-top: 24px; }
  .box { flex: 1; }
  .box .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: .12em;
                color: #9A9186; margin-bottom: 6px; }
  .kv { display: flex; font-size: 11.5px; color: #6B6259; padding: 2px 0; }
  .kv .k { width: 62px; color: #9A9186; }
  .kv .v { font-weight: 500; color: #1C1815; }
  .note { font-size: 11.5px; color: #6B6259; line-height: 1.6; }
  .foot { margin-top: 30px; padding-top: 14px; border-top: 1px solid #EAE4DA;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 10px; color: #9A9186; }
  .foot .mark { display: flex; align-items: center; gap: 5px; }
</style>
</head>
<body>
  <div class="rule"></div>

  <div class="top">
    <div>
      <div class="brandline">
        ${markSvg(20, '#F5A623')}
        <span class="creator-name">${esc(creator.name)}</span>
      </div>
      <div class="from">
        Content creator${creator.phone ? `<br/>${esc(creator.phone)}` : ''}
        ${creator.gstin ? `<br/>GSTIN ${esc(creator.gstin)}` : ''}
      </div>
    </div>
    <div class="doc">
      <div class="kind">${invoice.gst_applicable ? 'Tax invoice' : 'Invoice'}</div>
      <div class="number">${esc(invoice.invoice_number)}</div>
      <div class="meta">
        Issued ${formatDate(invoice.invoice_date)}
        ${invoice.payment_due_date ? `<br/>Due ${formatDate(invoice.payment_due_date)}` : ''}
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="label">Billed to</div>
      <div class="name">${esc(invoice.brand_name)}</div>
      ${
        invoice.brand_contact_person || invoice.brand_contact_email
          ? `<div class="detail">${[esc(invoice.brand_contact_person), esc(invoice.brand_contact_email)].filter(Boolean).join('<br/>')}</div>`
          : ''
      }
    </div>
    <div class="party">
      <div class="label">Payable to</div>
      <div class="name">${esc(creator.name)}</div>
      ${creator.gstin ? `<div class="detail">GSTIN ${esc(creator.gstin)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="c">Qty</th>
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
          <div class="hsn">SAC ${esc(item.hsn_sac)}</div>
        </td>
        <td class="c">${item.quantity}</td>
        <td class="r">${formatINR(item.unit_amount)}</td>
        <td class="r">${formatINR(item.amount)}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-inner">
      <div class="trow"><span>Subtotal</span><span>${formatINR(invoice.amount)}</span></div>
      ${
        invoice.gst_applicable
          ? `<div class="trow"><span>GST @ ${invoice.gst_rate}%</span><span>${formatINR(invoice.gst_amount)}</span></div>
             <div class="trow"><span>Invoice total</span><span>${formatINR(invoice.total_amount)}</span></div>`
          : ''
      }
      ${
        tds > 0
          ? `<div class="trow tds"><span>Less TDS withheld</span><span>− ${formatINR(tds)}</span></div>`
          : ''
      }
      <div class="trow net"><span>Net payable</span><span>${formatINR(netPayable)}</span></div>
    </div>
  </div>

  <div class="words">
    <div class="label">Amount in words</div>
    <div class="value">${amountInWords(netPayable)}</div>
  </div>

  <div class="lower">
    ${
      paymentRows.length > 0
        ? `<div class="box">
            <div class="label">Payment details</div>
            ${paymentRows
              .map((row) => `<div class="kv"><span class="k">${row[0]}</span><span class="v">${esc(row[1])}</span></div>`)
              .join('')}
          </div>`
        : ''
    }
    ${
      invoice.notes
        ? `<div class="box"><div class="label">Notes</div><div class="note">${esc(invoice.notes)}</div></div>`
        : ''
    }
  </div>

  ${
    // Only a registered creator may charge GST. Saying so explicitly stops a
    // finance team assuming tax was forgotten and holding up the payment.
    !invoice.gst_applicable
      ? `<div class="note" style="margin-top:18px;">GST not applicable${creator.gstin ? '' : ' — not GST registered'}.</div>`
      : ''
  }

  <div class="foot">
    <span>This is a computer-generated invoice and does not require a signature.</span>
    <span class="mark">${markSvg(11, '#9A9186')} CreatorDesk</span>
  </div>
</body>
</html>`.trim()
}
