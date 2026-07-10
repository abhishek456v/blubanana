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

export function buildPaymentReminderMessage(params: {
  brandName: string
  contactPerson: string | null
  deliverable: string
  amount: number
  dueDate: string
  tone: PaymentReminderTone
}): string {
  const { brandName, contactPerson, deliverable, amount, dueDate, tone } = params
  const greetingName = contactPerson?.trim() || brandName

  if (tone === 'due_soon') {
    return `Hi ${greetingName}, quick reminder — ${formatINR(amount)} for ${deliverable} is due on ${formatDate(dueDate)}. Let me know if you need anything from my end!`
  }

  return `Hi ${greetingName}, following up — ${formatINR(amount)} for ${deliverable} was due on ${formatDate(dueDate)} and I haven't received it yet. Could you share an update?`
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
