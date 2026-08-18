import { supabase } from './supabase'
import { getProfile } from './profile'
import { getSocialAccounts, getStatHistory, summarizeReach, isUsingMockProviders } from './social'
import { DELIVERABLE_LABELS } from '@/constants/labels'
import type { Creator, DeliverableKind } from '@/types'

// The shareable card (PRODUCT.md §8.11).
//
// Not a public web page — the thing a creator sends when a brand asks her to
// "share your commercials". Today she assembles that by hand from Instagram
// Insights every time, which is why it is always weeks out of date by the time
// it reaches anyone.
//
// Every figure here is derived from data the app already holds. Nothing on the
// card is a field she maintains, because a card she has to maintain goes stale
// and a stale card is worse than no card.

/** Kinds that are work, not commercial terms. Ad rights are priced per deal. */
const PRICEABLE_KINDS: DeliverableKind[] = [
  'reel',
  'story',
  'carousel',
  'static_post',
  'yt_short',
  'yt_long',
  'yt_integration',
  'live',
  'auto_dm',
]

export interface CardRate {
  kind: DeliverableKind
  label: string
  /** Rupees, per single unit of the deliverable. */
  typical: number
  /** How many past line items this is drawn from. */
  sampleSize: number
}

export interface ProfileCardData {
  name: string
  niche: string | null
  phone: string | null
  handles: { platform: string; handle: string }[]
  followers: number | null
  engagementRate: number | null
  rates: CardRate[]
  /** Rupees per view, across everything with both a rate and a view count. */
  costPerView: number | null
  /** When the follower/engagement figures were last refreshed. */
  statsAsOf: string | null
  /**
   * False while the social providers are mocked (§12: Meta and YouTube
   * credentials are still outstanding). The card says so rather than passing
   * invented engagement off as measured — a brand that later discovers the
   * number was fictional is a brand that does not come back.
   */
  statsAreLive: boolean
}

/**
 * The middle value, not the mean.
 *
 * One unusually large brand deal drags an average up far enough that the card
 * quotes a price she has been paid exactly once, and a rate card she cannot
 * defend in a negotiation is worse than no rate card.
 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

export async function getProfileCardData(): Promise<ProfileCardData> {
  const [profile, accounts, lineItems] = await Promise.all([
    getProfile(),
    getSocialAccounts().catch(() => []),
    // The masking view, so this respects `can_see_rates` like everything else:
    // a manager building the card gets no prices rather than the creator's.
    supabase
      .from('deal_deliverables_secure')
      .select('kind, rate, quantity, views')
      .then(({ data, error }) => {
        if (error) throw error
        return (data ?? []) as {
          kind: DeliverableKind
          rate: number | null
          quantity: number
          views: number | null
        }[]
      }),
  ])

  // ── Rates, per kind, from what she has actually charged ──────────────────
  const byKind = new Map<DeliverableKind, number[]>()
  for (const item of lineItems) {
    if (!PRICEABLE_KINDS.includes(item.kind)) continue
    // Null means withheld (025), zero means the line carried no price of its
    // own — a bundled item where the first line took the whole fee. Neither is
    // evidence of what a Reel costs.
    if (item.rate === null || item.rate <= 0) continue

    const quantity = item.quantity > 0 ? item.quantity : 1
    const perUnit = Math.round(item.rate / quantity)
    const existing = byKind.get(item.kind)
    if (existing) existing.push(perUnit)
    else byKind.set(item.kind, [perUnit])
  }

  const rates: CardRate[] = [...byKind.entries()]
    .map(([kind, values]) => ({
      kind,
      label: DELIVERABLE_LABELS[kind],
      typical: median(values),
      sampleSize: values.length,
    }))
    .sort((a, b) => b.typical - a.typical)

  // ── Cost per view ────────────────────────────────────────────────────────
  // Per line item rather than in aggregate: totalling rates and totalling views
  // lets one viral post set the price of everything else.
  const cpvs = lineItems
    .filter((i) => i.rate !== null && i.rate > 0 && i.views !== null && i.views > 0)
    .map((i) => i.rate! / i.views!)

  // ── Reach ────────────────────────────────────────────────────────────────
  // 'active' is the healthy state; expired/revoked/error accounts hold stale
  // numbers, and stale is the one thing this card must not be.
  const connected = accounts.filter((a) => a.status === 'active')
  let followers: number | null = profile?.follower_count ?? null
  let engagementRate: number | null = null
  let statsAsOf: string | null = null

  if (connected.length > 0) {
    const snapshots = await getStatHistory(connected[0].platform).catch(() => [])
    const reach = summarizeReach(snapshots)
    followers = reach.followers ?? followers
    engagementRate = reach.engagementRate
    statsAsOf = connected[0].last_synced_at
  }

  return {
    name: profile?.name ?? '',
    niche: profile?.niche ?? null,
    phone: profile?.phone ?? null,
    handles: connected.map((a) => ({ platform: a.platform as string, handle: a.handle })),
    followers,
    engagementRate,
    rates,
    costPerView: cpvs.length > 0 ? median(cpvs.map((v) => Math.round(v * 100))) / 100 : null,
    statsAsOf,
    statsAreLive: connected.length > 0 && !isUsingMockProviders(),
  }
}

/** True when there is not enough history for the card to be worth sending. */
export function cardIsThin(data: ProfileCardData): boolean {
  return data.rates.length === 0 && data.followers === null
}

export type { Creator }
