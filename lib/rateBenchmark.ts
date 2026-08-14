import type { Deal } from '@/types'
import type { StatSnapshot } from './social'

// Rate benchmarking.
//
// The question this answers is the one creators consistently get wrong: "my
// audience grew — should I be charging more?" Left to memory, the answer is
// almost always "I'll raise it next time", and next time never arrives.
//
// Two sources of reach, in order of preference:
//
//   1. `creator_stat_snapshots` — real daily figures from a connected
//      Instagram/YouTube account, including engagement rate. Lets the nudge
//      say something true about *engagement*, not just follower count.
//   2. `creator_follower_count_at_time` — a number the creator typed in,
//      captured when the deal was created. Always available, much coarser.
//
// It degrades rather than disappearing: with no connected account the nudge
// still works off the manual snapshot, exactly as it did before.

const MIN_DAYS_GAP = 60
const MIN_FOLLOWER_GROWTH = 0.15 // 15%+
/** Rate is "not keeping pace" below half the growth in reach. */
const PACE_THRESHOLD = 0.5

export interface RateBenchmarkNudge {
  followerGrowthPercent: number
  rateGrowthPercent: number
  pastRate: number
  currentRate: number
  pastFollowers: number
  currentFollowers: number
  /** Change in engagement rate, when connected-account history covers both deals. */
  engagementGrowthPercent: number | null
  /** True when the figures came from a connected account rather than manual entry. */
  fromConnectedAccount: boolean
  /** What the creator could charge to match her growth in reach. */
  suggestedRate: number
}

type BenchmarkDeal = Pick<Deal, 'rate' | 'creator_follower_count_at_time' | 'created_at'>

function daysAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
}

/**
 * The snapshot nearest a given date, within a tolerance.
 *
 * Nearest rather than most-recent-before: a deal signed the day before the
 * account was connected should use the first available reading rather than
 * nothing at all. The 45-day window stops a reading from a different quarter
 * standing in for one that was never taken.
 */
function reachNear(snapshots: StatSnapshot[], iso: string): StatSnapshot | null {
  const target = new Date(iso).getTime()
  const MAX_GAP_MS = 45 * 24 * 60 * 60 * 1000

  let best: StatSnapshot | null = null
  let bestGap = Infinity

  for (const snapshot of snapshots) {
    if (snapshot.followers == null) continue
    const gap = Math.abs(new Date(snapshot.captured_on).getTime() - target)
    if (gap < bestGap && gap <= MAX_GAP_MS) {
      best = snapshot
      bestGap = gap
    }
  }
  return best
}

/**
 * Whether the creator's rate has fallen behind her reach.
 *
 * Returns null far more often than not, deliberately. This surfaces as a
 * banner on Home, and a banner that appears every time you open the app is one
 * you stop seeing — so it only fires on a genuine, sustained gap: at least two
 * months apart, at least 15% growth in reach, and a rate that grew at less
 * than half that pace.
 */
export function getRateBenchmarkNudge(
  deals: BenchmarkDeal[],
  snapshots: StatSnapshot[] = []
): RateBenchmarkNudge | null {
  const chronological = [...deals].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // Reach for a deal: the connected account's reading if there is one near
  // that date, otherwise whatever was typed in at the time.
  const reachFor = (deal: BenchmarkDeal) => {
    const snapshot = reachNear(snapshots, deal.created_at)
    if (snapshot?.followers) {
      return {
        followers: snapshot.followers,
        engagement: snapshot.engagement_rate,
        connected: true,
      }
    }
    if (deal.creator_follower_count_at_time && deal.creator_follower_count_at_time > 0) {
      return {
        followers: deal.creator_follower_count_at_time,
        engagement: null,
        connected: false,
      }
    }
    return null
  }

  const usable = chronological.filter((deal) => reachFor(deal) !== null)
  if (usable.length < 2) return null

  const current = usable[usable.length - 1]
  const currentAge = daysAgo(current.created_at)

  // The oldest deal far enough back to be a meaningful comparison. Using the
  // earliest qualifying reference rather than merely "an older deal" makes the
  // growth signal less sensitive to one unusual month.
  const past = usable.find((deal) => daysAgo(deal.created_at) - currentAge >= MIN_DAYS_GAP)
  if (!past) return null

  const pastReach = reachFor(past)!
  const currentReach = reachFor(current)!

  const followerGrowthPercent =
    (currentReach.followers - pastReach.followers) / pastReach.followers
  if (followerGrowthPercent < MIN_FOLLOWER_GROWTH) return null

  const rateGrowthPercent = past.rate > 0 ? (current.rate - past.rate) / past.rate : 0
  if (rateGrowthPercent >= followerGrowthPercent * PACE_THRESHOLD) return null

  const engagementGrowthPercent =
    pastReach.engagement && currentReach.engagement && pastReach.engagement > 0
      ? (currentReach.engagement - pastReach.engagement) / pastReach.engagement
      : null

  return {
    followerGrowthPercent,
    rateGrowthPercent,
    pastRate: past.rate,
    currentRate: current.rate,
    pastFollowers: pastReach.followers,
    currentFollowers: currentReach.followers,
    engagementGrowthPercent,
    fromConnectedAccount: pastReach.connected && currentReach.connected,
    // What the old rate would be if it had tracked reach. Rounded to the
    // nearest ₹500 — a suggestion of "₹18,000" is one a creator can say out
    // loud in a negotiation; "₹17,847" is not.
    suggestedRate: Math.round((past.rate * (1 + followerGrowthPercent)) / 500) * 500,
  }
}

/** The one-line version, for the Home banner. */
export function describeNudge(nudge: RateBenchmarkNudge): string {
  const reach = `${Math.round(nudge.followerGrowthPercent * 100)}%`

  if (nudge.engagementGrowthPercent != null && nudge.engagementGrowthPercent > 0) {
    return `Your reach is up ${reach} and engagement is up ${Math.round(
      nudge.engagementGrowthPercent * 100
    )}% — but your rate hasn't moved. Try ₹${nudge.suggestedRate.toLocaleString('en-IN')}.`
  }

  return `Your reach is up ${reach} since an earlier deal but your rate hasn't kept pace. Try ₹${nudge.suggestedRate.toLocaleString(
    'en-IN'
  )}.`
}
