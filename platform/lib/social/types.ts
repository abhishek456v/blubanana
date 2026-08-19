// Everything that touches an external platform goes behind this interface.
//
// Instagram and YouTube will both change their APIs, their scopes and their
// review requirements inside eighteen months, and a third platform will
// eventually be added. None of that should require touching a screen or a
// service, only adding a file next to this one.

export type SocialPlatform = 'instagram' | 'youtube'

export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error'

/** A connected account, as the app is allowed to see it. No tokens. */
export interface SocialAccount {
  id: string
  workspace_id: string
  platform: SocialPlatform
  handle: string
  external_account_id: string | null
  token_expires_at: string | null
  scopes: string[]
  status: ConnectionStatus
  last_synced_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

/** One day's reach figures for one account. */
export interface StatSnapshot {
  id: string
  workspace_id: string
  social_account_id: string | null
  platform: SocialPlatform
  captured_on: string
  followers: number | null
  following: number | null
  posts_count: number | null
  avg_views: number | null
  avg_likes: number | null
  engagement_rate: number | null
  source: 'api' | 'manual'
  created_at: string
}

/** What a provider returns from a sync. Every field optional, since platforms differ. */
export interface FetchedStats {
  handle: string
  externalAccountId: string | null
  followers: number | null
  following?: number | null
  postsCount?: number | null
  avgViews?: number | null
  avgLikes?: number | null
  /** Percentage, e.g. 4.2 for 4.2%. */
  engagementRate: number | null
}

/** Performance for a single published post. */
export interface FetchedPostStats {
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reach: number | null
}

/**
 * A platform integration.
 *
 * `startConnect` returns a URL the app opens in a browser. The redirect lands
 * on an Edge Function that performs the code-for-token exchange server-side:
 * the client never handles a token, and the OAuth client secret never ships in
 * the app binary.
 */
export interface SocialProvider {
  readonly platform: SocialPlatform
  readonly displayName: string

  /** False when credentials are not configured; the UI shows "coming soon". */
  isConfigured(): boolean

  /** The authorisation URL to open. `state` ties the callback to a workspace. */
  buildAuthUrl(state: string): string

  /** Reach figures for the connected account. Called by the daily sync. */
  fetchStats(accountId: string): Promise<FetchedStats>

  /**
   * Performance for one published post.
   *
   * Returns null when the platform cannot resolve the URL: an unlisted video,
   * a deleted post, a personal account without insights. The caller falls back
   * to whatever the creator entered by hand, which must always stay possible.
   */
  fetchPostStats(accountId: string, postUrl: string): Promise<FetchedPostStats | null>
}
