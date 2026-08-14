import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'
import type { Deal, ReminderStage } from '@/types'

// Durable reminder chains (migration 015).
//
// The chain rule — one live reminder per chain, the next waiting on a response
// to the current one — is enforced by a partial unique index in the database,
// not here. This file is the convenient path; Postgres is the guarantee. If a
// function below ever races with itself, the second write fails loudly instead
// of quietly producing two nudges for the same piece of work.

export type ReminderType = 'workflow' | 'payment' | 'ad_rights' | 'survey'

export type ReminderStatus =
  | 'scheduled'
  | 'sent'
  | 'acknowledged'
  | 'snoozed'
  | 'escalated'
  | 'cancelled'
  | 'expired'

export interface Reminder {
  id: string
  workspace_id: string
  chain_id: string
  sequence_index: number
  parent_reminder_id: string | null
  type: ReminderType
  stage: ReminderStage | null
  deal_id: string | null
  payment_id: string | null
  title: string
  body: string | null
  scheduled_for: string
  status: ReminderStatus
  escalation_level: number
  snooze_count: number
  sent_at: string | null
  responded_at: string | null
  local_notification_id: string | null
  created_at: string
  updated_at: string
}

/** The states that occupy a chain's single live slot. */
const LIVE_STATUSES: ReminderStatus[] = ['scheduled', 'sent', 'escalated']

/**
 * Full stage order, mirroring STAGE_ORDER in lib/reminders.ts.
 *
 * Includes `live_link_submission`, which has no date column of its own (it is
 * derived as the day after publish) and so does not appear in WORKFLOW_STAGES
 * below. Indexing against the shorter list would give it a sequence_index of
 * -1 and sort it ahead of everything else.
 */
const STAGE_SEQUENCE: ReminderStage[] = [
  'script_due',
  'shoot',
  'editing',
  'publish',
  'live_link_submission',
]

/** Workflow stages that key off a date column, for chain building. */
const WORKFLOW_STAGES: { stage: ReminderStage; dateField: keyof Deal; title: string }[] = [
  { stage: 'script_due', dateField: 'script_due_date', title: 'Script due' },
  { stage: 'shoot', dateField: 'shoot_date', title: 'Shoot day' },
  { stage: 'editing', dateField: 'edit_done_date', title: 'Edit due' },
  { stage: 'publish', dateField: 'publish_date', title: 'Publish day' },
]

/** 9am local on the stage date — early enough to act, late enough to be awake. */
function morningOf(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 9, 0, 0, 0)
}

/**
 * Builds (or rebuilds) the workflow chain for a deal.
 *
 * Stages with no date are skipped entirely rather than scheduled with a guessed
 * one — a story repost has no script day, and inventing a deadline is worse
 * than having none.
 *
 * Already-answered reminders are never touched. Changing a deal's dates
 * cancels and rebuilds only the pending part of the chain, so a stage she has
 * already marked done does not reappear.
 */
export async function buildWorkflowChain(deal: Deal): Promise<Reminder | null> {
  const workspaceId = await getWorkspaceId()

  // One chain per deal's workflow, so cancelling and rebuilding is scoped.
  const chainId = deal.id

  // Clear only what has not been responded to. The unique index would reject
  // the new live reminder otherwise.
  const { error: cancelError } = await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .eq('chain_id', chainId)
    .in('status', LIVE_STATUSES)
  if (cancelError) throw cancelError

  const completedThrough = deal.reminder_completed_through
  const completedIndex = completedThrough
    ? WORKFLOW_STAGES.findIndex((s) => s.stage === completedThrough)
    : -1

  const now = Date.now()

  // The next stage that has a date and hasn't been completed. Past-dated
  // stages still schedule — an overdue nudge is the entire point.
  const next = WORKFLOW_STAGES.find((s, index) => {
    if (index <= completedIndex) return false
    return Boolean(deal[s.dateField])
  })

  if (!next) return null

  const dateStr = deal[next.dateField] as string
  const fireAt = morningOf(dateStr)
  // Never schedule into the past; a reminder that fires the instant it is
  // created reads as a glitch.
  const scheduledFor = fireAt.getTime() < now ? new Date(now + 60_000) : fireAt

  const { data, error } = await supabase
    .from('reminders')
    .insert({
      workspace_id: workspaceId,
      chain_id: chainId,
      sequence_index: WORKFLOW_STAGES.indexOf(next),
      type: 'workflow',
      stage: next.stage,
      deal_id: deal.id,
      title: next.title,
      body: deal.brand?.name ? `${deal.brand.name} · ${deal.deliverable_description}` : null,
      scheduled_for: scheduledFor.toISOString(),
      status: 'scheduled',
    })
    .select()
    .single()

  if (error) throw error
  return data as Reminder
}

/** The live reminder for a chain, if there is one. */
export async function getLiveReminder(chainId: string): Promise<Reminder | null> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('chain_id', chainId)
    .in('status', LIVE_STATUSES)
    .maybeSingle()

  if (error) throw error
  return (data as Reminder) ?? null
}

/** Everything due now across all chains — what the client schedules locally. */
export async function getDueReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })

  if (error) throw error
  return (data ?? []) as Reminder[]
}

/** Scheduled reminders yet to fire — the set the client mirrors to the OS. */
export async function getPendingReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .in('status', ['scheduled', 'sent'])
    .order('scheduled_for', { ascending: true })

  if (error) throw error
  return (data ?? []) as Reminder[]
}

export type ReminderResponse = 'done' | 'snooze_12h' | 'snooze_tomorrow'

/**
 * Records a response and advances the chain.
 *
 * A snooze creates a *new* row rather than moving the existing one, so the
 * full nudge history survives — three snoozes on one stage is a real signal
 * that a deadline is slipping, and mutating in place would erase it.
 *
 * Order matters: the current reminder must leave the live states before the
 * replacement is inserted, or the unique index rejects the write. That
 * rejection would be correct — it just makes for a confusing error — so the
 * sequence is explicit here.
 */
export async function respondToChainReminder(
  reminder: Reminder,
  response: ReminderResponse
): Promise<Reminder | null> {
  const now = new Date()

  if (response === 'done') {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'acknowledged', responded_at: now.toISOString() })
      .eq('id', reminder.id)
    if (error) throw error
    return null
  }

  const delayMs = response === 'snooze_12h' ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const nextAt = new Date(now.getTime() + delayMs)

  // Step 1: vacate the live slot.
  const { error: snoozeError } = await supabase
    .from('reminders')
    .update({ status: 'snoozed', responded_at: now.toISOString() })
    .eq('id', reminder.id)
  if (snoozeError) throw snoozeError

  // Step 2: the replacement, carrying the running snooze count forward.
  const snoozeCount = reminder.snooze_count + 1
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      workspace_id: reminder.workspace_id,
      chain_id: reminder.chain_id,
      sequence_index: reminder.sequence_index,
      parent_reminder_id: reminder.id,
      type: reminder.type,
      stage: reminder.stage,
      deal_id: reminder.deal_id,
      payment_id: reminder.payment_id,
      title: reminder.title,
      body: reminder.body,
      scheduled_for: nextAt.toISOString(),
      status: 'scheduled',
      snooze_count: snoozeCount,
      // After three snoozes the tone hardens and the dashboard flags the deal.
      // Escalating on snoozes rather than on elapsed time keeps it tied to
      // avoidance, which is the behaviour actually worth interrupting.
      escalation_level: snoozeCount >= 3 ? 1 : reminder.escalation_level,
    })
    .select()
    .single()

  if (error) throw error
  return data as Reminder
}

/**
 * Mirrors one workflow stage into the durable chain.
 *
 * Called from `lib/reminders.ts` at the moment the OS notification is
 * scheduled, so the database row and the notification always describe the same
 * thing. Passing `stage: null` just clears the chain — the deal has no further
 * scheduled work.
 *
 * The old live row is cancelled before the new one is inserted, because the
 * partial unique index permits exactly one live reminder per chain and would
 * otherwise reject the write.
 */
export async function syncChainReminder(params: {
  dealId: string
  stage: ReminderStage | null
  fireAt: Date | null
  notificationId: string | null
  title: string
  body: string | null
}): Promise<void> {
  const { dealId, stage, fireAt, notificationId, title, body } = params

  const existing = await getLiveReminder(dealId)

  // Idempotent: if the live row already describes this exact stage and time,
  // leave it alone. `rescheduleWorkflowReminder` short-circuits when nothing
  // changed, and cancel-then-reinsert on every save would reset snooze_count —
  // destroying the very history escalation is based on.
  if (
    existing &&
    stage &&
    fireAt &&
    existing.stage === stage &&
    new Date(existing.scheduled_for).getTime() === fireAt.getTime()
  ) {
    // Keep the notification id current; the OS one may have been rescheduled.
    if (notificationId && existing.local_notification_id !== notificationId) {
      await supabase
        .from('reminders')
        .update({ local_notification_id: notificationId })
        .eq('id', existing.id)
    }
    return
  }

  if (existing) {
    const { error: cancelError } = await supabase
      .from('reminders')
      .update({ status: 'cancelled' })
      .eq('id', existing.id)
    if (cancelError) throw cancelError
  }

  if (!stage || !fireAt) return

  const { error } = await supabase.from('reminders').insert({
    workspace_id: await getWorkspaceId(),
    chain_id: dealId,
    sequence_index: Math.max(0, STAGE_SEQUENCE.indexOf(stage)),
    type: 'workflow',
    stage,
    deal_id: dealId,
    title,
    body,
    scheduled_for: fireAt.toISOString(),
    status: 'scheduled',
    local_notification_id: notificationId,
  })
  if (error) throw error
}

/**
 * Re-creates OS notifications from the durable chain.
 *
 * This is the payoff for storing reminders in the database: after a reinstall,
 * a device switch, or the OS clearing its notification queue, the schedule is
 * recoverable. Without it, everything scheduled before the wipe is silently
 * lost and the creator finds out by missing a deadline.
 *
 * Called on app launch. Returns how many were restored.
 */
export async function rebuildLocalNotifications(
  schedule: (
    reminder: Reminder
  ) => Promise<string | null>
): Promise<number> {
  const pending = await getPendingReminders()
  const now = Date.now()
  let restored = 0

  for (const reminder of pending) {
    // Already-due reminders are surfaced in-app by the deal screen rather than
    // scheduled — asking the OS to fire in the past does nothing useful.
    if (new Date(reminder.scheduled_for).getTime() <= now) continue

    const notificationId = await schedule(reminder)
    if (!notificationId) continue

    await supabase
      .from('reminders')
      .update({ local_notification_id: notificationId })
      .eq('id', reminder.id)
    restored += 1
  }

  return restored
}

/** Cancels a chain outright — deal closed, or work no longer needed. */
export async function cancelChain(chainId: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .eq('chain_id', chainId)
    .in('status', LIVE_STATUSES)
  if (error) throw error
}

/** Deals whose reminders have been snoozed enough to be worth flagging. */
export async function getStalledChains(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .in('status', LIVE_STATUSES)
    .gte('snooze_count', 3)

  if (error) throw error
  return (data ?? []) as Reminder[]
}
