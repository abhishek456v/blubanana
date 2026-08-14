import { getDeals, type DealWithPaymentSummary } from './deals'
import { getPendingReminders, type Reminder } from './reminderChains'
import { getAttentionItems, type AttentionItem } from './insights'

// The unified feed behind the bell and the Reminders screen.
//
// Deliberately built from what already exists rather than a new
// `notifications` table. Two sources, two different shapes of truth:
//
//   * `reminders` — scheduled rows the creator can answer (done / snooze).
//     These are commitments with a time attached.
//   * attention items — derived every render from deal state (payment eight
//     days late, published with no link). Nothing to snooze; they clear when
//     the underlying fact changes.
//
// A separate notifications table would have to be kept in sync with both and
// would be wrong the moment a deal was edited on another device.

export interface ReminderAlert {
  kind: 'reminder'
  id: string
  reminder: Reminder
  deal: DealWithPaymentSummary | null
  /** When it is (or was) meant to surface. */
  at: Date
}

export interface DerivedAlert {
  kind: 'derived'
  id: string
  item: AttentionItem
}

export type Alert = ReminderAlert | DerivedAlert

export interface AlertFeed {
  /** Reminders whose time has come or passed, plus everything derived. */
  today: Alert[]
  /** Reminders still in the future. */
  upcoming: ReminderAlert[]
  /** What the bell badge shows — the count of things needing a look now. */
  dueCount: number
  deals: DealWithPaymentSummary[]
}

export const EMPTY_FEED: AlertFeed = {
  today: [],
  upcoming: [],
  dueCount: 0,
  deals: [],
}

/**
 * Builds the feed.
 *
 * Reminders are fetched independently of deals: the reminders table arrived in
 * a later migration than deals, so one being unavailable must not blank the
 * other half of the screen.
 */
export async function getAlertFeed(): Promise<AlertFeed> {
  const [deals, reminders] = await Promise.all([
    getDeals().catch(() => [] as DealWithPaymentSummary[]),
    getPendingReminders().catch(() => [] as Reminder[]),
  ])

  return buildAlertFeed(deals, reminders)
}

/** The pure half, so the split can be tested without a network. */
export function buildAlertFeed(
  deals: DealWithPaymentSummary[],
  reminders: Reminder[],
  now: Date = new Date()
): AlertFeed {
  const dealsById = new Map(deals.map((deal) => [deal.id, deal]))

  const today: Alert[] = []
  const upcoming: ReminderAlert[] = []

  for (const reminder of reminders) {
    const at = new Date(reminder.scheduled_for)
    const alert: ReminderAlert = {
      kind: 'reminder',
      id: reminder.id,
      reminder,
      deal: reminder.deal_id ? (dealsById.get(reminder.deal_id) ?? null) : null,
      at,
    }
    // `sent` means the OS already showed it, so it belongs in today's list
    // even if its scheduled time is somehow still ahead (clock skew, a device
    // that fired early).
    if (at.getTime() <= now.getTime() || reminder.status === 'sent') today.push(alert)
    else upcoming.push(alert)
  }

  const reminderDealIds = new Set(
    reminders.map((reminder) => reminder.deal_id).filter(Boolean) as string[]
  )

  for (const item of getAttentionItems(deals)) {
    // A deal with a live reminder is already represented above. Listing it
    // twice would make the badge overstate how much is actually waiting.
    if (reminderDealIds.has(item.deal.id)) continue
    today.push({ kind: 'derived', id: `derived-${item.deal.id}-${item.kind}`, item })
  }

  today.sort(sortAlerts)
  upcoming.sort((a, b) => a.at.getTime() - b.at.getTime())

  return { today, upcoming, dueCount: today.length, deals }
}

// Danger before warning before info; within a tone, oldest first. A payment
// eight days late outranks a shoot that is due this morning.
const TONE_RANK = { danger: 0, warning: 1, info: 2 } as const

function sortAlerts(a: Alert, b: Alert): number {
  const rank = (alert: Alert) =>
    alert.kind === 'derived' ? TONE_RANK[alert.item.tone] : alert.reminder.escalation_level > 0 ? 0 : 1

  const byRank = rank(a) - rank(b)
  if (byRank !== 0) return byRank

  const time = (alert: Alert) => (alert.kind === 'reminder' ? alert.at.getTime() : 0)
  return time(a) - time(b)
}

/** "Overdue by 3 days" / "in 2 hours" — the time line on a reminder row. */
export function describeWhen(at: Date, now: Date = new Date()): string {
  const diffMs = at.getTime() - now.getTime()
  const past = diffMs < 0
  const minutes = Math.round(Math.abs(diffMs) / 60000)

  if (minutes < 60) {
    const unit = minutes === 1 ? 'minute' : 'minutes'
    return past ? `${minutes} ${unit} ago` : `in ${minutes} ${unit}`
  }

  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    const unit = hours === 1 ? 'hour' : 'hours'
    return past ? `${hours} ${unit} ago` : `in ${hours} ${unit}`
  }

  const days = Math.round(hours / 24)
  const unit = days === 1 ? 'day' : 'days'
  return past ? `${days} ${unit} ago` : `in ${days} ${unit}`
}
