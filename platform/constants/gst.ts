// GST state codes, and the one rule that decides how tax is split.
//
// Under the IGST Act a supply is *inter-State* when the supplier's State and
// the place of supply differ, and *intra-State* when they match. That single
// comparison decides whether an invoice carries IGST at the full rate or CGST
// and SGST at half each. Getting it wrong is not cosmetic: the recipient
// cannot claim input credit against the wrong head, and a finance team will
// send the invoice back.
//
// For a creator's services the place of supply is the recipient's location
// (s.12(2) IGST Act: a registered recipient's registered address).

export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
}

export const GST_STATE_OPTIONS = Object.entries(GST_STATE_CODES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name))

/** The first two characters of any GSTIN are its State code. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null
  const code = gstin.trim().slice(0, 2)
  return GST_STATE_CODES[code] ? code : null
}

export function stateName(code: string | null | undefined): string | null {
  return code ? (GST_STATE_CODES[code] ?? null) : null
}

/** "27 - Maharashtra", the form Rule 46(m) asks for. */
export function placeOfSupplyLabel(code: string | null | undefined): string | null {
  const name = stateName(code)
  return name ? `${code} - ${name}` : null
}

export interface GstSplit {
  cgst: number
  sgst: number
  igst: number
  interState: boolean
}

/**
 * Splits a tax amount across the correct heads.
 *
 * Falls back to inter-State when the supplier's own State cannot be
 * determined, because IGST on a single line is the assumption a recipient can
 * most easily correct, whereas a wrongly-split CGST/SGST pair looks authoritative
 * and quietly misstates two different tax heads.
 */
export function splitGst(
  gstAmount: number,
  supplierStateCode: string | null,
  placeOfSupplyCode: string | null
): GstSplit {
  const interState =
    !supplierStateCode || !placeOfSupplyCode || supplierStateCode !== placeOfSupplyCode

  if (interState) {
    return { cgst: 0, sgst: 0, igst: gstAmount, interState: true }
  }

  // Half each, with the rounding remainder given to CGST so the two halves
  // always add back to exactly the tax charged.
  const half = Math.floor(gstAmount / 2)
  return { cgst: gstAmount - half, sgst: half, igst: 0, interState: false }
}
