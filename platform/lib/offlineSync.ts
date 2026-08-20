import { File } from 'expo-file-system'
import { createBrand } from './brands'
import { createDeal } from './deals'
import { replaceStages } from './dealStages'
import { extractFromImage, extractFromTranscript, transcribeAudio } from './aiIntake'
import {
  flushQueue,
  offlineQueueAvailable,
  readQueue,
  type FlushResult,
  type QueuedItem,
} from './offlineQueue'

// Replaying what was captured offline (PRODUCT.md §8.19).
//
// Every handler calls the same lib function the online path calls. That is the
// whole design: an offline deal is not a different kind of deal, it is the same
// creation arriving late — so it gets the payment row, the due dates, the
// stages and the reminders, and there is no second code path to drift.

/** A queued screenshot or voice note, once it has been read back off disk. */
async function readCachedBase64(uri: string): Promise<string> {
  const file = new File(uri)
  return file.base64Sync()
}

/**
 * Deletes the cached file behind an intake, once it has synced.
 *
 * Best-effort: a leftover file in the cache directory is harmless and the OS
 * clears it eventually. Failing the sync because cleanup failed would requeue
 * an item that has already been extracted, and she would get the deal twice.
 */
function forget(uri: string | undefined): void {
  if (!uri) return
  try {
    new File(uri).delete()
  } catch {
    // See above.
  }
}

const handlers: Record<QueuedItem['kind'], (item: QueuedItem) => Promise<void>> = {
  create_brand: async (item) => {
    await createBrand(item.payload as Parameters<typeof createBrand>[0])
  },

  create_deal: async (item) => {
    const { stages, ...input } = item.payload as unknown as Parameters<typeof createDeal>[0] & {
      stages?: Parameters<typeof replaceStages>[1]
    }
    const deal = await createDeal(input)
    // Stages go with the deal, not as a separate queue entry: half a deal
    // arriving is worse than none, and a deal with no stages has no deadlines
    // and therefore no reminders — which is the feature she was offline for.
    if (stages?.length) await replaceStages(deal.id, stages)
  },

  // The app has no single-stage setter: marking one done rewrites the deal's
  // whole stage list through replaceStages, which is what preserves `done_at`
  // for the stages that did not change. The queue replays exactly that rather
  // than inventing a narrower write that would drift from it.
  complete_stage: async (item) => {
    const { dealId, stages } = item.payload as unknown as {
      dealId: string
      stages: Parameters<typeof replaceStages>[1]
    }
    await replaceStages(dealId, stages)
  },

  intake_image: async (item) => {
    if (!item.fileUri) throw new Error('The screenshot is no longer on this device')
    const base64 = await readCachedBase64(item.fileUri)
    const fields = await extractFromImage(base64, (item.payload.mimeType as string) ?? 'image/jpeg')
    await createDealFromExtraction(fields)
    forget(item.fileUri)
  },

  intake_audio: async (item) => {
    if (!item.fileUri) throw new Error('The voice note is no longer on this device')
    const base64 = await readCachedBase64(item.fileUri)
    const transcript = await transcribeAudio(
      base64,
      (item.payload.mimeType as string) ?? 'audio/m4a'
    )
    const fields = await extractFromTranscript(transcript)
    await createDealFromExtraction(fields)
    forget(item.fileUri)
  },
}

/**
 * Turns an extraction into a deal, on sync.
 *
 * §8.3's rule is that screenshot and voice intake never save silently — they
 * fill the form for review. That rule is about the *online* path, where she is
 * standing there to review it. Offline, the alternative to saving is losing the
 * capture entirely, which is the failure §8.19 exists to prevent.
 *
 * So it saves, and the deal is marked for review by carrying the model's own
 * uncertainty into the notes rather than pretending the fields are confirmed.
 */
async function createDealFromExtraction(
  fields: Awaited<ReturnType<typeof extractFromImage>>
): Promise<void> {
  const brandName = fields.brand_name?.trim() || 'Unknown brand'
  const brand = await createBrand({
    name: brandName,
    notes: null,
  })

  await createDeal({
    brand_id: brand.id,
    platform: fields.platform ?? 'instagram_reel',
    deliverable_description: fields.deliverable_description ?? 'Captured offline',
    rate: fields.rate ?? 0,
    publish_date: fields.publish_date,
    payment_terms: fields.payment_terms,
    notes: [
      'Captured offline and read automatically — please check the figures.',
      fields.notes,
    ]
      .filter(Boolean)
      .join('\n\n'),
  })
}

/** How many captures are waiting. Zero on web, where the queue does not run. */
export async function pendingCount(): Promise<number> {
  if (!offlineQueueAvailable()) return 0
  return (await readQueue()).length
}

/** Replays everything waiting. Safe to call when there is nothing to do. */
export async function syncOfflineQueue(): Promise<FlushResult> {
  if (!offlineQueueAvailable()) return { synced: 0, failed: 0, remaining: 0 }
  return flushQueue(handlers)
}
