import type { Deal, ReminderStage } from '@/types'
import { scheduleAsync, cancelAsync, type NotificationContent } from './notifications'

// Workflow reminder sequencing (PRODUCT.md 2.3): script due → shoot day →
// editing → publishing → live link submission. Only one reminder is ever
// outstanding per deal — the next stage's reminder is scheduled only once
// the creator responds to the current one (or, for the very first stage,
// once a deal has a date to schedule against at all).

export const STAGE_ORDER: ReminderStage[] = [
  'script_due',
  'shoot',
  'editing',
  'publish',
  'live_link_submission',
]

// PRODUCT.md doesn't specify a time of day for date-only reminders — 9am
// local is a reasonable default for a creator checking her day's work.
const DEFAULT_REMINDER_HOUR = 9

type TimelineDeal = Pick<Deal, 'script_due_date' | 'shoot_date' | 'edit_done_date' | 'publish_date'>

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day + days).toISOString().split('T')[0]
}

// live_link_submission has no dedicated timeline column — it's derived as
// the day after publish_date.
function getStageDateString(deal: TimelineDeal, stage: ReminderStage): string | null {
  switch (stage) {
    case 'script_due':
      return deal.script_due_date
    case 'shoot':
      return deal.shoot_date
    case 'editing':
      return deal.edit_done_date
    case 'publish':
      return deal.publish_date
    case 'live_link_submission':
      return deal.publish_date ? addDays(deal.publish_date, 1) : null
  }
}

function stageDateToFireAt(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, DEFAULT_REMINDER_HOUR, 0, 0, 0)
}

// Walks the stage sequence starting at fromIndex, returning the first stage
// with a date to schedule against.
export function findNextActiveStage(deal: TimelineDeal, fromIndex: number): ReminderStage | null {
  for (let i = fromIndex; i < STAGE_ORDER.length; i++) {
    if (getStageDateString(deal, STAGE_ORDER[i])) return STAGE_ORDER[i]
  }
  return null
}

const REMINDER_TITLES: Record<ReminderStage, string> = {
  script_due: 'Script due',
  shoot: 'Shoot day',
  editing: 'Edit due',
  publish: 'Publish day',
  live_link_submission: 'Add the live link',
}

function buildReminderContent(stage: ReminderStage, dealId: string, brandName: string): NotificationContent {
  const bodies: Record<ReminderStage, string> = {
    script_due: `Script for ${brandName} is due today.`,
    shoot: `Shoot day for ${brandName} is today.`,
    editing: `Editing for ${brandName} should wrap up today.`,
    publish: `${brandName}'s deliverable is due to go live today.`,
    live_link_submission: `Don't forget to add the live link for ${brandName}.`,
  }
  return {
    title: REMINDER_TITLES[stage],
    body: bodies[stage],
    data: { type: 'workflow', dealId, stage },
  }
}

export interface ReminderFields {
  reminder_stage: ReminderStage | null
  reminder_fire_at: string | null
  reminder_notification_id: string | null
  // Furthest stage explicitly marked Done — a monotonically-advancing floor
  // that's distinct from reminder_stage (see rescheduleWorkflowReminder).
  reminder_completed_through: ReminderStage | null
}

// Cancels whatever was previously scheduled and schedules the given stage/
// time (or clears the reminder entirely when stage is null). The one place
// that actually touches expo-notifications for workflow reminders.
async function applyReminder(
  deal: Pick<Deal, 'id' | 'reminder_notification_id' | 'brand'>,
  stage: ReminderStage | null,
  fireAt: Date | null,
  completedThrough: ReminderStage | null
): Promise<ReminderFields> {
  await cancelAsync(deal.reminder_notification_id)

  if (!stage || !fireAt) {
    return {
      reminder_stage: null,
      reminder_fire_at: null,
      reminder_notification_id: null,
      reminder_completed_through: completedThrough,
    }
  }

  const brandName = deal.brand?.name ?? 'this brand'
  const notificationId = await scheduleAsync(buildReminderContent(stage, deal.id, brandName), fireAt)

  return {
    reminder_stage: stage,
    reminder_fire_at: fireAt.toISOString(),
    reminder_notification_id: notificationId,
    reminder_completed_through: completedThrough,
  }
}

// Called whenever a deal's timeline dates are created or edited. Always
// searches forward from the stage just past reminder_completed_through
// (the furthest stage explicitly marked Done) — NOT from the current
// reminder_stage. Those two can differ: reminder_stage may be sitting on a
// later stage simply because an earlier stage had no date yet when it was
// last computed. Using reminder_stage itself as the floor would mean a date
// added retroactively to an earlier, never-actually-completed stage could
// never resurface. Using reminder_completed_through means it correctly
// does, while a stage genuinely marked Done never resurfaces regardless of
// later edits.
export async function rescheduleWorkflowReminder(deal: Deal): Promise<ReminderFields> {
  const floorIndex = deal.reminder_completed_through
    ? STAGE_ORDER.indexOf(deal.reminder_completed_through) + 1
    : 0
  const stage = findNextActiveStage(deal, floorIndex)

  if (!stage) {
    if (!deal.reminder_stage) {
      return {
        reminder_stage: deal.reminder_stage,
        reminder_fire_at: deal.reminder_fire_at,
        reminder_notification_id: deal.reminder_notification_id,
        reminder_completed_through: deal.reminder_completed_through,
      }
    }
    return applyReminder(deal, null, null, deal.reminder_completed_through)
  }

  const fireAt = stageDateToFireAt(getStageDateString(deal, stage)!)
  const unchanged =
    stage === deal.reminder_stage &&
    deal.reminder_fire_at !== null &&
    new Date(deal.reminder_fire_at).getTime() === fireAt.getTime()

  if (unchanged) {
    return {
      reminder_stage: deal.reminder_stage,
      reminder_fire_at: deal.reminder_fire_at,
      reminder_notification_id: deal.reminder_notification_id,
      reminder_completed_through: deal.reminder_completed_through,
    }
  }

  return applyReminder(deal, stage, fireAt, deal.reminder_completed_through)
}

export type ReminderResponse = 'done' | 'remind_12h' | 'remind_tomorrow'

// Called when the creator taps a response on the in-app reminder card.
export async function respondToWorkflowReminder(
  deal: Deal,
  response: ReminderResponse
): Promise<ReminderFields> {
  if (!deal.reminder_stage) {
    return {
      reminder_stage: null,
      reminder_fire_at: null,
      reminder_notification_id: null,
      reminder_completed_through: deal.reminder_completed_through,
    }
  }

  if (response === 'done') {
    const currentIndex = STAGE_ORDER.indexOf(deal.reminder_stage)
    const nextStage = findNextActiveStage(deal, currentIndex + 1)
    if (!nextStage) return applyReminder(deal, null, null, deal.reminder_stage)
    return applyReminder(
      deal,
      nextStage,
      stageDateToFireAt(getStageDateString(deal, nextStage)!),
      deal.reminder_stage
    )
  }

  const base = deal.reminder_fire_at ? new Date(deal.reminder_fire_at) : new Date()
  const fireAt =
    response === 'remind_12h'
      ? new Date(Date.now() + 12 * 60 * 60 * 1000)
      : new Date(base.getTime() + 24 * 60 * 60 * 1000)

  return applyReminder(deal, deal.reminder_stage, fireAt, deal.reminder_completed_through)
}

// Safety net for when a deal is fully closed out (status reaches 'paid') —
// cancels any still-scheduled reminder regardless of what stage it's on.
export async function clearWorkflowReminder(
  deal: Pick<Deal, 'reminder_notification_id'>
): Promise<ReminderFields> {
  await cancelAsync(deal.reminder_notification_id)
  return {
    reminder_stage: null,
    reminder_fire_at: null,
    reminder_notification_id: null,
    reminder_completed_through: null,
  }
}
