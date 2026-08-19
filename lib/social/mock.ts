import type {
  FetchedPostStats,
  FetchedStats,
  SocialPlatform,
  SocialProvider,
} from './types'

/**
 * A provider that fabricates plausible numbers, for building against before
 * Meta and Google app review are approved.
 *
 * This exists so the entire connect → sync → chart flow can be finished and
 * tested now, rather than being written blind and debugged for the first time
 * on the day real credentials arrive. When they do, `instagram.ts` implements
 * the same interface and the registry swaps which one is used, with no screen and
 * no service changes.
 *
 * Two properties matter for it to be useful rather than merely present:
 *
 *  - **Deterministic.** The same account id always produces the same figures,
 *    so a screenshot taken today matches one taken tomorrow and a chart does
 *    not reshuffle on every reload.
 *  - **Trending.** Followers drift upward day over day, because a flat line
 *    would make the growth-versus-rate comparison (the whole point of
 *    collecting this) untestable.
 */
export class MockSocialProvider implements SocialProvider {
  readonly platform: SocialPlatform
  readonly displayName: string

  constructor(platform: SocialPlatform) {
    this.platform = platform
    this.displayName = platform === 'instagram' ? 'Instagram' : 'YouTube'
  }

  isConfigured(): boolean {
    return true
  }

  buildAuthUrl(state: string): string {
    // Never opened. The mock connect path writes the row directly, since
    // there is no real authorisation server to redirect to.
    return `blubanana://social/mock-callback?state=${encodeURIComponent(state)}`
  }

  async fetchStats(accountId: string): Promise<FetchedStats> {
    const seed = hash(accountId)
    // Day index so figures advance over time instead of being frozen.
    const day = Math.floor(Date.now() / 86_400_000)

    const base = 12_000 + (seed % 180_000)
    const growth = (day % 400) * (10 + (seed % 40))
    const followers = base + growth

    return {
      handle: `creator_${(seed % 9000) + 1000}`,
      externalAccountId: `mock-${seed}`,
      followers,
      following: 300 + (seed % 900),
      postsCount: 80 + (day % 300),
      avgViews: Math.round(followers * (0.25 + ((seed % 30) / 100))),
      avgLikes: Math.round(followers * (0.03 + ((seed % 20) / 1000))),
      engagementRate: Number((2.5 + ((seed % 45) / 10)).toFixed(2)),
    }
  }

  async fetchPostStats(accountId: string, postUrl: string): Promise<FetchedPostStats | null> {
    // A real provider returns null for posts it cannot resolve. The mock does
    // the same for anything that isn't a plausible URL, so the manual-entry
    // fallback gets exercised during development rather than only in
    // production the first time a creator pastes an unlisted link.
    if (!/^https?:\/\//i.test(postUrl)) return null

    const seed = hash(accountId + postUrl)
    const views = 4_000 + (seed % 220_000)

    return {
      views,
      likes: Math.round(views * (0.04 + ((seed % 40) / 1000))),
      comments: Math.round(views * (0.002 + ((seed % 10) / 10_000))),
      shares: Math.round(views * (0.003 + ((seed % 12) / 10_000))),
      saves: Math.round(views * (0.006 + ((seed % 18) / 10_000))),
      reach: Math.round(views * (1.1 + ((seed % 30) / 100))),
    }
  }
}

/** Small deterministic string hash: same input, same figures, every time. */
function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
