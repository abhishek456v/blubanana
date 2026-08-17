import { stagesInOrder, type DealWithPaymentSummary } from './deals'
import { getPaymentAlertTone } from './paymentReminders'
import { getAdRightsStatus } from './adRights'
import { daysFromToday, formatRelativeDay } from './format'

// What Home puts at the top of the screen.
//
// The dashboard used to be a flat, filterable list of every deal, leaving the
// creator to work out which of them actually needed her today. These functions
// answer that directly, which is the whole promise of the product: never miss
// a deadline, never forget a payment.

export type AttentionKind =
  | 'payment_overdue'
  | 'payment_due_soon'
  | 'deadline_passed'
  | 'deadline_today'
  | 'link_missing'
  | 'ad_rights_expiring'

export type AttentionTone = 'danger' | 'warning' | 'info'

export interface AttentionItem {
  deal: DealWithPaymentSummary
  kind: AttentionKind
  tone: AttentionTone
  /** One short line naming the action: "Payment 8 days late". */
  reason: string
}

// Lower sorts first. Money already owed outranks work not yet done, because a
// late payment is the thing she cannot recover by working harder today.
const PRIORITY: Record<AttentionKind, number> = {
  payment_overdue: 0,
  deadline_passed: 1,
  deadline_today: 2,
  payment_due_soon: 3,
  link_missing: 4,
  ad_rights_expiring: 5,
}

/**
 * The date the deal's current stage is working toward, if any.
 *
 * The first stage that is not done, read from the deal's own stages. Switching
 * on status stopped working once stages became user-defined (migration 019):
 * a deal whose creator renamed or reordered them has no fixed "Shoot" to look
 * up. A paid deal is not waiting on any stage.
 */
function currentStageDeadline(deal: DealWithPaymentSummary): { label: string; date: string } | null {
  if (deal.status === 'paid') return null

  const next = stagesInOrder(deal).find((stage) => !stage.done)
  return next?.due_date ? { label: next.name, date: next.due_date } : null
}

/**
 * Everything asking for the creator's attention right now, most urgent first.
 *
 * A deal contributes at most one item. Showing the same brand three times over
 * would bury the other deals that also need her, and she opens the deal to
 * deal with all of it anyway.
 */
export function getAttentionItems(deals: DealWithPaymentSummary[]): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const deal of deals) {
    if (deal.status === 'paid') continue

    const candidates: AttentionItem[] = []

    const paymentTone = deal.payment ? getPaymentAlertTone(deal.payment) : null
    if (paymentTone === 'overdue' && deal.payment?.due_date) {
      const late = Math.abs(daysFromToday(deal.payment.due_date))
      candidates.push({
        deal,
        kind: 'payment_overdue',
        tone: 'danger',
        reason: late === 0 ? 'Payment due today' : `Payment ${late} ${late === 1 ? 'day' : 'days'} late`,
      })
    } else if (paymentTone === 'due_soon' && deal.payment?.due_date) {
      candidates.push({
        deal,
        kind: 'payment_due_soon',
        tone: 'warning',
        reason: `Payment due ${formatRelativeDay(deal.payment.due_date).toLowerCase()}`,
      })
    }

    const deadline = currentStageDeadline(deal)
    if (deadline) {
      const days = daysFromToday(deadline.date)
      if (days < 0) {
        candidates.push({
          deal,
          kind: 'deadline_passed',
          tone: 'danger',
          reason: `${deadline.label} was due ${formatRelativeDay(deadline.date).toLowerCase()}`,
        })
      } else if (days === 0) {
        candidates.push({
          deal,
          kind: 'deadline_today',
          tone: 'warning',
          reason: `${deadline.label} due today`,
        })
      }
    }

    // Published with no link is a dead end: the payment clock never starts,
    // so this silently costs her money if it goes unnoticed.
    if (deal.status === 'published' && !deal.live_link) {
      candidates.push({
        deal,
        kind: 'link_missing',
        tone: 'info',
        reason: 'Add the live link to start the payment clock',
      })
    }

    if (getAdRightsStatus(deal) === 'expiring_soon' && deal.ad_rights_expires_date) {
      candidates.push({
        deal,
        kind: 'ad_rights_expiring',
        tone: 'warning',
        reason: `Ad rights end ${formatRelativeDay(deal.ad_rights_expires_date).toLowerCase()}`,
      })
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
      items.push(candidates[0])
    }
  }

  return items.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
}

export interface HomeMetrics {
  /** Payments actually received this calendar month. */
  earnedThisMonth: number
  /** Everything invoiced or expected and not yet in her account. */
  outstanding: number
  /** Of that, the part already past its due date. */
  overdue: number
  activeDeals: number
}

function isSameMonth(dateStr: string, ref: Date): boolean {
  const [year, month] = dateStr.split('-').map(Number)
  return year === ref.getFullYear() && month - 1 === ref.getMonth()
}

export function getHomeMetrics(deals: DealWithPaymentSummary[]): HomeMetrics {
  const now = new Date()
  let earnedThisMonth = 0
  let outstanding = 0
  let overdue = 0
  let activeDeals = 0

  for (const deal of deals) {
    const payment = deal.payment

    if (payment?.status === 'paid' && payment.paid_date) {
      if (isSameMonth(payment.paid_date, now)) {
        earnedThisMonth += payment.amount ?? deal.rate
      }
    } else if (payment) {
      const amount = payment.amount ?? deal.rate
      outstanding += amount
      if (getPaymentAlertTone(payment) === 'overdue') overdue += amount
    }

    if (deal.status !== 'paid') activeDeals += 1
  }

  return { earnedThisMonth, outstanding, overdue, activeDeals }
}

/** "Morning" / "Afternoon" / "Evening": the greeting on Home. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

/** "Thursday, 14 August": the eyebrow above the greeting. */
export function todayLabel(now: Date = new Date()): string {
  return now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}
