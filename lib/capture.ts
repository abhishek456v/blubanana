import NetInfo from '@react-native-community/netinfo'
import { createBrand } from './brands'
import type { CreateDealInput } from './deals'
import type { StageDraft } from './dealStages'
import { enqueue, offlineQueueAvailable } from './offlineQueue'

// The capture paths §8.19 puts behind a queue.
//
// "She never sees a failure." So each of these decides, once, whether to write
// now or to remember: online it is the ordinary path with no queue involved at
// all; offline it records the intent and returns as though it had saved,
// because from her point of view it has.

/**
 * Whether a write should be attempted at all.
 *
 * `isInternetReachable` is null while being determined, and unknown is treated
 * as online: attempting and failing costs a moment, whereas queueing a write
 * that would have succeeded means her deal is not really there when she looks
 * for it.
 */
async function isOffline(): Promise<boolean> {
  if (!offlineQueueAvailable()) return false
  const state = await NetInfo.fetch()
  return !state.isConnected || state.isInternetReachable === false
}

/**
 * Whether this write should be queued instead of attempted.
 *
 * Exported deliberately, so a caller branches *before* doing anything. An
 * earlier version of this module had one `captureDeal()` that either queued or
 * created — and a screen that called it and then continued into its normal
 * save path created the deal twice. Separating the question from the action
 * makes that mistake impossible to write.
 */
export async function shouldQueue(): Promise<boolean> {
  return isOffline()
}

/**
 * Remembers a deal and its stages as one entry.
 *
 * Together, not as two, because half a deal arriving is worse than none — and a
 * deal with no stages has no deadlines, which is the feature she was offline
 * for in the first place.
 */
export async function queueDeal(
  input: CreateDealInput,
  stages: StageDraft[],
  brandName: string
): Promise<void> {
  await enqueue(
    'create_deal',
    { ...input, stages },
    // What she sees in the pending list. A brand and a rate identify the deal;
    // "create_deal" identifies nothing.
    `${brandName}${input.rate ? ` · ₹${input.rate.toLocaleString('en-IN')}` : ''}`
  )
}

export async function queueBrand(
  input: Parameters<typeof createBrand>[0]
): Promise<void> {
  await enqueue('create_brand', input as unknown as Record<string, unknown>, input.name)
}

/**
 * Remembers a stage change as the whole list.
 *
 * `replaceStages` is how the app writes a stage change online, and replaying
 * the same call keeps `done_at` handling identical. A narrower "stage X is
 * done" entry would be a second write path to keep in step with the first, and
 * it would not stay in step.
 */
export async function queueStages(
  dealId: string,
  stages: StageDraft[],
  dealLabel: string
): Promise<void> {
  await enqueue('complete_stage', { dealId, stages }, dealLabel)
}
