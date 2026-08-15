// Pre-filled WhatsApp click-to-chat links (PRODUCT.md section 0's documented
// shortcut in place of the WhatsApp Business API) for payment follow-ups
// (PRODUCT.md 2.4). Nothing here ever sends anything — every consumer opens
// the resulting URL via Linking.openURL, which hands off to WhatsApp for the
// creator to review and send herself.

export type PaymentReminderTone = 'due_soon' | 'overdue'

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

// Parses YYYY-MM-DD as a local date, matching the pattern used elsewhere
// (DealRow.tsx, deal/new.tsx) to avoid UTC offset shifting the displayed day.
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * The payment chaser, escalating from friendly to firm.
 *
 * `escalationLevel` counts how many chasers have already gone out, not how
 * overdue the payment is — a creator who only started chasing today should not
 * open in the tone of a fourth follow-up.
 *
 * Every level stays professional. These go to a brand the creator may want to
 * work with again, and a message she would be embarrassed to have sent is one
 * she will stop sending — which costs her far more than a firm tone would.
 * The escalation is in the directness and in what is asked for, not in warmth.
 */
export function buildPaymentReminderMessage(params: {
  brandName: string
  contactPerson: string | null
  deliverable: string
  amount: number
  dueDate: string
  tone: PaymentReminderTone
  escalationLevel?: number
  liveLink?: string | null
  invoiceNumber?: string | null
}): string {
  const {
    brandName,
    contactPerson,
    deliverable,
    amount,
    dueDate,
    tone,
    escalationLevel = 0,
    liveLink,
    invoiceNumber,
  } = params

  const name = contactPerson?.trim() || brandName
  const money = formatINR(amount)
  const due = formatDate(dueDate)

  // Included automatically so she never has to scroll back through six weeks
  // of chat to find the link or the invoice number — the specific friction
  // that stops creators chasing at all.
  const reference = [
    invoiceNumber ? `Invoice ${invoiceNumber}` : null,
    liveLink ? `Link: ${liveLink}` : null,
  ]
    .filter(Boolean)
    .join('\n')
  const tail = reference ? `\n\n${reference}` : ''

  if (tone === 'due_soon') {
    return `Hi ${name}, quick heads-up: ${money} for ${deliverable} is due on ${due}. Anything you need from my end to get it processed?${tail}`
  }

  switch (Math.min(escalationLevel, 3)) {
    case 0:
      return `Hi ${name}, following up on ${money} for ${deliverable}, which was due on ${due} and I haven't received it yet. Could you share an update?${tail}`
    case 1:
      return `Hi ${name}, checking in again on ${money} for ${deliverable}, due ${due}. Could you let me know where this is in your payment run?${tail}`
    case 2:
      return `Hi ${name}, ${money} for ${deliverable} is now well past its ${due} due date. Could you confirm a payment date, or put me in touch with your finance team?${tail}`
    default:
      return `Hi ${name}, I still haven't received ${money} for ${deliverable}, due ${due}. I'd like to get this settled this week. Could you confirm when it will be paid?${tail}`
  }
}

// Sent once, when the deal moves published → payment_awaited (PRODUCT.md 2.5).
export function buildLiveLinkMessage(params: {
  brandName: string
  contactPerson: string | null
  deliverable: string
  liveLink: string
}): string {
  const { brandName, contactPerson, deliverable, liveLink } = params
  const greetingName = contactPerson?.trim() || brandName
  return `Hi ${greetingName}, ${deliverable} is live! Here's the link: ${liveLink}`
}

// Normalizes a stored phone number into digits-only, assuming an Indian
// number when given a bare 10-digit local number (reasonable given the
// schema is INR-only, but not something PRODUCT.md states explicitly).
// Returns null when there's nothing usable to build a link from.
function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return `91${digits}`
  return digits
}

export function buildWhatsAppLink(phone: string, message: string): string | null {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
