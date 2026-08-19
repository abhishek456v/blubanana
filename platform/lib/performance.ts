import type { Deliverable, DeliverableKind } from '@/types'
import { paymentsInOrder, stagesInOrder, type DealWithPaymentSummary } from './deals'

/**
 * When the work went out: the last stage that carries a date.
 *
 * Replaces `deal.publish_date`, which stopped existing when stages became
 * user-defined (migration 019). The last dated stage is the publish day on a
 * default schedule and whatever she called it otherwise.
 */
function lastStageDate(deal: DealWithPaymentSummary): string | null {
  const dated = stagesInOrder(deal).filter((stage) => stage.due_date)
  return dated.length > 0 ? dated[dated.length - 1].due_date : null
}
import { COMMERCIAL_KINDS } from '@/constants/labels'

// Content performance.
//
// Every number here comes from figures the creator typed in herself: there is
// no Instagram Graph API or YouTube Data API connection yet, and both need app
// credentials that don't exist. The shape of these functions is the same
// either way, so wiring a real sync later means changing where the numbers are
// written, not how they are read.

export interface DeliverablePerformance {
  deliverable: Deliverable
  deal: DealWithPaymentSummary
  views: number
  /** Likes + comments + saves + shares: the actions a viewer chose to take. */
  engagements: number
  /**
   * Engagements as a share of reach, or of views when reach is missing.
   * Null when neither denominator was entered: a rate computed against zero
   * is worse than an honest blank on a screen about how well work performed.
   */
  engagementRate: number | null
  /** Rupees paid per thousand views. The brand's side of the trade. */
  costPerMille: number | null
}

export interface KindPerformance {
  kind: DeliverableKind
  count: number
  avgViews: number
  avgEngagementRate: number | null
}

export interface PerformanceSummary {
  items: DeliverablePerformance[]
  totalViews: number
  totalEngagements: number
  avgEngagementRate: number | null
  best: DeliverablePerformance | null
  byKind: KindPerformance[]
  /** How many published items still have no numbers entered. */
  missingCount: number
}

function sum(...values: (number | null)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

/**
 * Joins deliverables to their deals and derives the per-item figures.
 *
 * Ad rights and auto-DM lines are excluded: they are commercial terms, not
 * posts, so they have no reach to measure and would drag every average down
 * toward zero if counted.
 */
export function buildPerformance(
  deals: DealWithPaymentSummary[],
  deliverablesByDeal: Map<string, Deliverable[]>
): PerformanceSummary {
  const items: DeliverablePerformance[] = []
  let missingCount = 0

  for (const deal of deals) {
    for (const deliverable of deliverablesByDeal.get(deal.id) ?? []) {
      if (COMMERCIAL_KINDS.includes(deliverable.kind)) continue

      const views = deliverable.views ?? 0
      const engagements = sum(
        deliverable.likes,
        deliverable.comments,
        deliverable.saves,
        deliverable.shares
      )
      const denominator = deliverable.reach ?? deliverable.views ?? 0

      if (views === 0 && engagements === 0) {
        // Only count it as "missing numbers" if it actually went live;
        // an unpublished reel isn't waiting on data entry.
        if (deliverable.published_at || deliverable.live_link) missingCount += 1
        continue
      }

      items.push({
        deliverable,
        deal,
        views,
        engagements,
        engagementRate: denominator > 0 ? engagements / denominator : null,
        // Null when the rate is withheld as well as when there are no views:
        // cost per mille without a cost is not a number worth showing.
        costPerMille:
          deliverable.rate !== null && views > 0 ? (deliverable.rate / views) * 1000 : null,
      })
    }
  }

  const rates = items
    .map((item) => item.engagementRate)
    .filter((rate): rate is number => rate !== null)

  // "Best" is by engagement rate rather than raw views: a 40k-view reel that
  // nobody saved taught the creator less than a 9k-view one that people did.
  const best =
    items.length > 0
      ? items.reduce((leader, item) =>
          (item.engagementRate ?? 0) > (leader.engagementRate ?? 0) ? item : leader
        )
      : null

  const grouped = new Map<DeliverableKind, DeliverablePerformance[]>()
  for (const item of items) {
    const existing = grouped.get(item.deliverable.kind)
    if (existing) existing.push(item)
    else grouped.set(item.deliverable.kind, [item])
  }

  const byKind: KindPerformance[] = [...grouped.entries()]
    .map(([kind, group]) => ({
      kind,
      count: group.length,
      avgViews: Math.round(mean(group.map((item) => item.views)) ?? 0),
      avgEngagementRate: mean(
        group
          .map((item) => item.engagementRate)
          .filter((rate): rate is number => rate !== null)
      ),
    }))
    .sort((a, b) => (b.avgEngagementRate ?? 0) - (a.avgEngagementRate ?? 0))

  return {
    items: items.sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0)),
    totalViews: items.reduce((total, item) => total + item.views, 0),
    totalEngagements: items.reduce((total, item) => total + item.engagements, 0),
    avgEngagementRate: mean(rates),
    best,
    byKind,
    missingCount,
  }
}

/** `4.2%`: engagement rates are small fractions, so one decimal is enough. */
export function formatRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

/** `1.2M` / `48.5K` / `820`: view counts, in the notation creators use. */
export function formatCount(value: number | null | undefined): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(value)
}

export interface ArchiveYear {
  year: number
  deals: DealWithPaymentSummary[]
  totalEarned: number
  dealCount: number
}

/**
 * The full back catalogue, newest year first.
 *
 * Bucketed by calendar year rather than financial year deliberately: this is
 * the creator's record of her own work, and April-to-March is a tax construct
 * that belongs on the Money side of the app.
 */
export function buildArchive(deals: DealWithPaymentSummary[]): ArchiveYear[] {
  const buckets = new Map<number, DealWithPaymentSummary[]>()

  for (const deal of deals) {
    // Publish date is when the work actually existed; created_at is only a
    // fallback for deals logged but never shipped.
    const reference = lastStageDate(deal) ?? deal.created_at
    const year = Number(reference.slice(0, 4))
    if (!Number.isFinite(year)) continue

    const existing = buckets.get(year)
    if (existing) existing.push(deal)
    else buckets.set(year, [deal])
  }

  return [...buckets.entries()]
    .map(([year, yearDeals]) => ({
      year,
      deals: yearDeals.sort((a, b) =>
        (lastStageDate(b) ?? b.created_at).localeCompare(lastStageDate(a) ?? a.created_at)
      ),
      totalEarned: yearDeals
        .flatMap((deal) => paymentsInOrder(deal))
        .filter((payment) => payment.status === 'paid')
        .reduce((total, payment) => total + (payment.amount_received ?? payment.amount), 0),
      dealCount: yearDeals.length,
    }))
    .sort((a, b) => b.year - a.year)
}
