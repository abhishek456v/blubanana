import qrcode from 'qrcode-generator'

// The UPI QR on the invoice (PRODUCT.md §8.8).
//
// The brand scans it and pays creator-to-creator, bank to bank. Money never
// touches this product, which is exactly why the feature is affordable: taking
// a payment would make us a payment aggregator, with the licensing and the
// settlement liability that implies. §10 rules that out explicitly, and this is
// the answer that replaces it.

/**
 * A UPI virtual payment address: `name@handle`.
 *
 * Deliberately loose. The handle list changes as banks and PSPs come and go,
 * and a creator whose valid VPA is rejected by our regex has no way to fix it —
 * the failure mode of being too strict is worse than of being too lax, because
 * an unscannable QR is visibly broken while a rejected valid address looks like
 * our bug. Which it would be.
 */
const VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/

export function isValidUpiId(upiId: string | null | undefined): boolean {
  return !!upiId && VPA.test(upiId.trim())
}

/**
 * The `upi://pay` URI a UPI app understands when it scans the code.
 *
 * Returns null rather than a partial URI when there is no usable VPA: a QR that
 * scans to nothing is worse than no QR, because the brand's finance team tries
 * it, it fails, and the creator is not there to see it happen.
 *
 * `am` is the amount in rupees. Every money value in this codebase is a whole
 * number of rupees (see the note at the top of types/index.ts), so this never
 * needs paise — but UPI wants a decimal string, and some apps reject a bare
 * integer, so it is always written with two places.
 */
export function buildUpiUri(params: {
  upiId: string
  payeeName: string
  amount: number
  note?: string | null
}): string | null {
  const { upiId, payeeName, amount, note } = params
  const vpa = upiId.trim()
  if (!isValidUpiId(vpa)) return null
  if (!Number.isFinite(amount) || amount <= 0) return null

  const query = [
    `pa=${encodeURIComponent(vpa)}`,
    `pn=${encodeURIComponent(payeeName.trim() || 'Creator')}`,
    `am=${amount.toFixed(2)}`,
    'cu=INR',
    note ? `tn=${encodeURIComponent(note.trim().slice(0, 50))}` : null,
  ]
    .filter(Boolean)
    .join('&')

  return `upi://pay?${query}`
}

/**
 * An inline SVG for the given payload, to embed directly in the invoice HTML.
 *
 * SVG rather than a PNG data URI because the invoice is printed as well as
 * viewed: a raster QR at A4 print resolution is either enormous in the file or
 * soft at the edges, and a soft QR is a QR that takes three attempts to scan.
 *
 * Error correction level M — the standard trade-off, and enough to survive a
 * printed page being creased or scanned at an angle. Level H would tolerate
 * more damage at the cost of a denser code, which is the wrong way round when
 * the usual failure is a low-resolution phone camera rather than damage.
 */
export function upiQrSvg(payload: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(payload)
  qr.make()
  // scalable so the surrounding CSS decides the printed size; margin 0 because
  // the invoice template supplies its own quiet zone as padding.
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
}

/**
 * The QR for an invoice, or null if it cannot be built.
 *
 * One entry point so a caller cannot accidentally render a code for the wrong
 * amount: the payload and the image are produced together from the same inputs.
 */
export function invoiceUpiQr(params: {
  upiId: string | null | undefined
  payeeName: string
  amount: number
  invoiceNumber?: string | null
}): { uri: string; svg: string } | null {
  const { upiId, payeeName, amount, invoiceNumber } = params
  if (!upiId) return null

  const uri = buildUpiUri({
    upiId,
    payeeName,
    amount,
    note: invoiceNumber ? `Invoice ${invoiceNumber}` : null,
  })
  if (!uri) return null

  return { uri, svg: upiQrSvg(uri) }
}
