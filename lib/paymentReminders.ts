import type { Deal, Payment } from '@/types'
import { scheduleAsync, cancelAsync, type NotificationContent } from './notifications'

// Payment due-date reminder scheduling (PRODUCT.md 2.4): a local notification
// 3 days before due_date, and another on due_date itself if still pending.
// Both deep-link to the deal screen, where the actual wa.me message is built
// and sent by the creator (see lib/whatsapp.ts). Nothing here ever sends
// anything, it only decides when to nudge her to.

const DEFAULT_REMINDER_HOUR = 9
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

function dateAtHour(dateStr: string, hour: number): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, hour, 0, 0, 0)
}

type PaymentType = 'payment_due_soon' | 'payment_due_today'

function buildContent(type: PaymentType, dealId: string, brandName: string): NotificationContent {
  const isSoon = type === 'payment_due_soon'
  return {
    title: isSoon ? 'Payment due soon' : 'Payment due today',
    body: isSoon
      ? `${brandName}'s payment is due in 3 days.`
      : `${brandName}'s payment is due today.`,
    data: { type, dealId },
  }
}

export interface PaymentReminderFields {
  due_soon_notification_id: string | null
  due_today_notification_id: string | null
}

async function cancelExisting(
  payment: Pick<Payment, 'due_soon_notification_id' | 'due_today_notification_id'>
): Promise<void> {
  await cancelAsync(payment.due_soon_notification_id)
  await cancelAsync(payment.due_today_notification_id)
}

// Called whenever due_date is (re)calculated. Cancels whatever was
// previously scheduled and schedules fresh against the current due_date.
// Thresholds already in the past (e.g. editing a deal whose due date is
// already within 3 days) are silently skipped rather than firing immediately.
export async function reschedulePaymentReminders(
  payment: Pick<Payment, 'due_soon_notification_id' | 'due_today_notification_id' | 'due_date'>,
  deal: Pick<Deal, 'id' | 'brand'>
): Promise<PaymentReminderFields> {
  await cancelExisting(payment)

  if (!payment.due_date) {
    return { due_soon_notification_id: null, due_today_notification_id: null }
  }

  const brandName = deal.brand?.name ?? 'Brand'
  const dueAt = dateAtHour(payment.due_date, DEFAULT_REMINDER_HOUR)
  const dueSoonAt = new Date(dueAt.getTime() - THREE_DAYS_MS)
  const now = Date.now()

  const dueSoonId =
    dueSoonAt.getTime() > now
      ? await scheduleAsync(buildContent('payment_due_soon', deal.id, brandName), dueSoonAt)
      : null
  const dueTodayId =
    dueAt.getTime() > now
      ? await scheduleAsync(buildContent('payment_due_today', deal.id, brandName), dueAt)
      : null

  return { due_soon_notification_id: dueSoonId, due_today_notification_id: dueTodayId }
}

// Called once a deal's payment is fully settled (advanceDealStatus reaching
// 'paid') so a stale reminder never fires for a payment that's done.
export async function cancelPaymentReminders(
  payment: Pick<Payment, 'due_soon_notification_id' | 'due_today_notification_id'>
): Promise<PaymentReminderFields> {
  await cancelExisting(payment)
  return { due_soon_notification_id: null, due_today_notification_id: null }
}

// There's no reliable background JS execution for local notifications in
// Expo's managed workflow, so "pending/reminder_sent past its due_date
// becomes overdue" is enforced lazily here instead; call on every deal load.
export function isPaymentOverdue(payment: Pick<Payment, 'due_date' | 'status'>): boolean {
  if (!payment.due_date) return false
  if (payment.status === 'paid' || payment.status === 'overdue') return false

  const [year, month, day] = payment.due_date.split('-').map(Number)
  const due = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due.getTime() < today.getTime()
}

// Drives whether the deal screen shows a "Send WhatsApp reminder" button and
// which message tone to use, with the same 3-day/due-date thresholds as the
// scheduled notifications, computed fresh so it's correct even if the
// notification never fired (permission denied, app never opened, etc).
export function getPaymentAlertTone(
  payment: Pick<Payment, 'due_date' | 'status'>
): 'due_soon' | 'overdue' | null {
  if (!payment.due_date || payment.status === 'paid') return null
  if (payment.status === 'overdue' || isPaymentOverdue(payment)) return 'overdue'

  const [year, month, day] = payment.due_date.split('-').map(Number)
  const due = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

  return daysUntilDue <= 3 ? 'due_soon' : null
}
