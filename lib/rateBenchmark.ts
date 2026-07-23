import type { Deal } from '@/types'

// Rate benchmarking (Phase 2, simplified). The product brief's full version
// compares rate against *engagement*, which needs a live Instagram/YouTube
// API connection that doesn't exist yet (see PRODUCT.md section 0 and
// README). This uses creator_follower_count_at_time — a snapshot taken at
// deal-creation time (lib/deals.ts) — as a proxy: if follower count has
// grown meaningfully since an older deal but the rate hasn't kept pace,
// that's still a useful, honest nudge without pretending to have
// engagement data this app doesn't have.

const MIN_DAYS_GAP = 60
const MIN_FOLLOWER_GROWTH = 0.15 // 15%+

export interface RateBenchmarkNudge {
  followerGrowthPercent: number
  rateGrowthPercent: number
  pastRate: number
  currentRate: number
  pastFollowers: number
  currentFollowers: number
}

type BenchmarkDeal = Pick<Deal, 'rate' | 'creator_follower_count_at_time' | 'created_at'>

function daysAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
}

export function getRateBenchmarkNudge(deals: BenchmarkDeal[]): RateBenchmarkNudge | null {
  const usable = deals
    .filter((d) => d.creator_follower_count_at_time != null && d.creator_follower_count_at_time > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  if (usable.length < 2) return null

  const current = usable[usable.length - 1]
  const currentAge = daysAgo(current.created_at)

  // Earliest deal old enough to give a meaningful comparison window —
  // using the oldest available reference (not just "any older deal")
  // makes the growth signal more reliable.
  const past = usable.find((d) => daysAgo(d.created_at) - currentAge >= MIN_DAYS_GAP)
  if (!past) return null

  const pastFollowers = past.creator_follower_count_at_time!
  const currentFollowers = current.creator_follower_count_at_time!
  const followerGrowthPercent = (currentFollowers - pastFollowers) / pastFollowers
  if (followerGrowthPercent < MIN_FOLLOWER_GROWTH) return null

  const rateGrowthPercent = past.rate > 0 ? (current.rate - past.rate) / past.rate : 0
  // Rate hasn't kept pace if it grew at less than half the rate followers did.
  if (rateGrowthPercent >= followerGrowthPercent * 0.5) return null

  return {
    followerGrowthPercent,
    rateGrowthPercent,
    pastRate: past.rate,
    currentRate: current.rate,
    pastFollowers,
    currentFollowers,
  }
}
