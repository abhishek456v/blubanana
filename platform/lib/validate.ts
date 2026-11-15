import { GST_STATE_CODES } from '@/constants/gst'
import { isValidUpiId } from '@/lib/upi'

// Format checks for the details that end up on a tax invoice or in a nudge.
//
// Every one of these fields is optional, so each check takes a blank to mean
// "nothing entered" and passes it. What it will not pass is something that is
// there and cannot be right: a GSTIN of "GARBAGE" used to be saved, switch
// "Charge GST" on by default (it keys off the field being filled), and go out
// on an invoice to a brand's finance team.
//
// Each returns the sentence to show under the field, or null when it is fine.
// Where a rule is deliberately loose it says so: a rejected valid value has no
// way out, whereas a lax check only fails to catch a typo.

const blank = (value: string | null | undefined): boolean => !value || !value.trim()

/** Upper-cases and strips spaces, which is how all three registries print them. */
export const tidyId = (value: string): string => value.replace(/\s+/g, '').toUpperCase()

const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN_SHAPE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const IFSC_SHAPE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * The check character GSTN computes over the first fourteen: each character is
 * its base-36 value, doubled in alternate positions, folded back into one base-36
 * digit, and summed. It catches a single mistyped character and almost every
 * swap, which a format check alone cannot.
 */
function gstinCheckChar(first14: string): string {
  let sum = 0
  for (let i = 0; i < 14; i += 1) {
    const product = BASE36.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(product / 36) + (product % 36)
  }
  return BASE36[(36 - (sum % 36)) % 36]
}

export function gstinError(value: string | null | undefined): string | null {
  if (blank(value)) return null
  const gstin = tidyId(value as string)
  if (!GSTIN_SHAPE.test(gstin)) {
    return 'A GSTIN is 15 characters, like 27AAPFU0939F1ZV.'
  }
  if (!GST_STATE_CODES[gstin.slice(0, 2)]) {
    return 'The first two digits are not a State code.'
  }
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14]) {
    return 'That GSTIN does not check out. Look for a mistyped character.'
  }
  return null
}

export function panError(value: string | null | undefined, gstin?: string | null): string | null {
  if (blank(value)) return null
  const pan = tidyId(value as string)
  if (!PAN_SHAPE.test(pan)) return 'A PAN is 10 characters, like ABCDE1234F.'
  // Characters 3 to 12 of a GSTIN are the holder's PAN, so the two cannot
  // disagree. Only checked when the GSTIN is itself well formed.
  if (!blank(gstin) && !gstinError(gstin) && tidyId(gstin as string).slice(2, 12) !== pan) {
    return 'This PAN does not match the one inside your GSTIN.'
  }
  return null
}

export function ifscError(value: string | null | undefined): string | null {
  if (blank(value)) return null
  return IFSC_SHAPE.test(tidyId(value as string))
    ? null
    : 'An IFSC is 11 characters, like HDFC0001234.'
}

/** Indian accounts run 9 to 18 digits; banks differ, so nothing tighter. */
export function accountNumberError(value: string | null | undefined): string | null {
  if (blank(value)) return null
  return /^[0-9]{9,18}$/.test((value as string).replace(/\s+/g, ''))
    ? null
    : 'An account number is 9 to 18 digits.'
}

export function upiError(value: string | null | undefined): string | null {
  if (blank(value)) return null
  return isValidUpiId(value) ? null : 'A UPI ID looks like name@bank.'
}

/**
 * Ten digits, or a country code in front of them. Spaces, dashes, brackets and
 * a leading + or 0 are the ways people write the same number, so they pass.
 */
export function phoneError(value: string | null | undefined): string | null {
  if (blank(value)) return null
  const raw = (value as string).trim()
  if (!/^[+0-9()\s-]+$/.test(raw)) return 'A phone number has digits only.'
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 ? null : 'Enter a 10-digit phone number.'
}

export function emailError(value: string | null | undefined): string | null {
  if (blank(value)) return null
  return EMAIL_SHAPE.test((value as string).trim()) ? null : 'That does not look like an email.'
}

/** The first error in a set of checks, for a form that shows one message. */
export function firstError(...errors: (string | null)[]): string | null {
  return errors.find((error) => error) ?? null
}
