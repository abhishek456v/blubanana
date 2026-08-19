import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Capture that survives no signal (PRODUCT.md §8.19).
//
// "The promise is 'log a deal in thirty seconds', and the moment that matters
// most is on a shoot, in a basement studio, with no signal."
//
// ── What this is, and what it deliberately is not ───────────────────────────
//
// A queue of intents, not a local mirror of the database. §8.19 scopes offline
// to *capture* — a new deal, a new brand, a stage marked done, an intake
// started — and leaves dashboards, invoices, reports and search needing a
// connection, because those are things you sit down to do. A full local-first
// replica is perhaps five times the work for the other 80% of moments, and
// every one of them happens at a desk.
//
// ── Why intents rather than rows ────────────────────────────────────────────
//
// Each entry records what she meant, not what the database row would look like.
// Replaying `createDeal` on sync means an offline deal gets the payment record,
// the due-date calculation, the stages and the reminders that an online one
// does — through exactly the same code. Queuing a pre-built row would fork the
// creation path in two, and the offline copy would be the one that quietly
// stopped matching.

const STORAGE_KEY = 'creatordesk.offline.queue.v1'

export type QueuedKind =
  | 'create_deal'
  | 'create_brand'
  | 'complete_stage'
  | 'intake_image'
  | 'intake_audio'

export interface QueuedItem {
  id: string
  kind: QueuedKind
  /** Arguments for the lib call that will be replayed. */
  payload: Record<string, unknown>
  /** For an intake, the cached file this refers to. Deleted after a successful sync. */
  fileUri?: string
  /** Shown in the pending list, so she can see what is waiting rather than a count. */
  label: string
  createdAt: string
  /** Incremented on each failed flush. See `MAX_ATTEMPTS`. */
  attempts: number
  lastError?: string
}

/**
 * After this many failures an item stops being retried automatically.
 *
 * Something that has failed five times is not failing because of signal. It is
 * a deal the server is rejecting — a brand name too long, a constraint it
 * breaks — and retrying it forever would block the queue behind it and burn
 * battery. It stays in the list, visible, with its reason.
 */
export const MAX_ATTEMPTS = 5

/**
 * Native only, exactly as §8.19 scopes it.
 *
 * On web a browser tab has no meaningful "on a shoot with no signal" moment,
 * and the failure modes of a queue that survives a refresh are a different
 * project. Queueing there would add a state to reason about for no gain.
 */
export function offlineQueueAvailable(): boolean {
  return Platform.OS !== 'web'
}

export async function readQueue(): Promise<QueuedItem[]> {
  if (!offlineQueueAvailable()) return []
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueuedItem[]) : []
  } catch {
    // A corrupt queue must not brick capture. Losing the queue is bad; an app
    // that cannot save anything because of one malformed entry is worse.
    return []
  }
}

async function writeQueue(items: QueuedItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

/** Adds an intent. Returns the stored item so the caller can show it as pending. */
export async function enqueue(
  kind: QueuedKind,
  payload: Record<string, unknown>,
  label: string,
  fileUri?: string
): Promise<QueuedItem> {
  const item: QueuedItem = {
    // Date.now alone collides when two things are queued in the same
    // millisecond, which is exactly what happens when a screen saves a deal and
    // its stages together.
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    payload,
    fileUri,
    label,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }

  await writeQueue([...(await readQueue()), item])
  return item
}

export async function removeFromQueue(id: string): Promise<void> {
  await writeQueue((await readQueue()).filter((item) => item.id !== id))
}

async function recordFailure(id: string, reason: string): Promise<void> {
  await writeQueue(
    (await readQueue()).map((item) =>
      item.id === id ? { ...item, attempts: item.attempts + 1, lastError: reason } : item
    )
  )
}

/** Items that will still be retried. The rest need her attention. */
export function pending(items: readonly QueuedItem[]): QueuedItem[] {
  return items.filter((item) => item.attempts < MAX_ATTEMPTS)
}

export function stuck(items: readonly QueuedItem[]): QueuedItem[] {
  return items.filter((item) => item.attempts >= MAX_ATTEMPTS)
}

export interface FlushResult {
  synced: number
  failed: number
  remaining: number
}

/**
 * Replays the queue, oldest first.
 *
 * Order matters and is not incidental: a deal queued after the brand it belongs
 * to must be created after it, or the brand reference points at nothing. FIFO
 * is what keeps that true without the queue having to model dependencies.
 *
 * Stops at the first failure rather than skipping past it, for the same reason.
 * If a brand fails to sync, every deal behind it in the queue would fail too,
 * and burning all five attempts on each would turn one recoverable error into a
 * queue full of dead entries.
 *
 * `handlers` is passed in rather than imported so this module stays free of the
 * lib layer — `lib/deals` already imports half the app, and a cycle through the
 * queue would be a genuinely difficult one to unpick.
 */
export async function flushQueue(
  handlers: Record<QueuedKind, (item: QueuedItem) => Promise<void>>
): Promise<FlushResult> {
  const items = pending(await readQueue()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      await handlers[item.kind](item)
      await removeFromQueue(item.id)
      synced++
    } catch (error) {
      await recordFailure(item.id, error instanceof Error ? error.message : 'Sync failed')
      failed++
      break
    }
  }

  const after = await readQueue()
  return { synced, failed, remaining: pending(after).length }
}

/** Drops everything, including stuck items. Used only when she asks. */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}
