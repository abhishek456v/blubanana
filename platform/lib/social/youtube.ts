import { supabase } from '../supabase'
import type {
  FetchedPostStats,
  FetchedStats,
  SocialPlatform,
  SocialProvider,
} from './types'

// YouTube, through the YouTube Data API v3.
//
// Structurally identical to `meta.ts`, and for the same reason: every call
// needs an access token, migration 013 revokes the token columns from
// `authenticated`, so the client can never hold one. This provider only asks
// the `social-sync` edge function, which reads the token with the service role
// and talks to Google.
//
// ── Why this is a separate file rather than a branch in meta.ts ─────────────
//
// It is a different company's OAuth, a different consent screen, a different
// review process and a different set of quota rules. The one thing the two
// share is the shape in `types.ts`, which is exactly what `PROVIDERS` needs to
// swap them. Merging them would trade a clean interface for a file full of
// `if (platform === ...)`.
//
// ── What "configured" means ─────────────────────────────────────────────────
//
// The OAuth client id is public and ships in the bundle; the client *secret*
// is a function secret and never leaves the server. So `isConfigured()` tests
// the public half only, which is what decides whether the app can start an
// OAuth flow at all. A missing secret surfaces server-side as a failed
// exchange rather than as a button that quietly does nothing.

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? ''

/**
 * Read-only, and deliberately the narrowest scope that works.
 *
 * `youtube.readonly` covers the channel's own statistics and its videos, which
 * is everything this app needs. It is a "sensitive" scope in Google's terms,
 * so it requires app verification before public use, but not the "restricted"
 * treatment (annual third-party security audit) that `youtube.force-ssl` or
 * anything write-capable would pull in. Asking for one scope more than needed
 * would change the review from a form into an audit.
 */
const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'].join(' ')

/** Google requires an exact match against the console entry, so it is derived, never typed. */
function redirectUri(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
  return `${base}/functions/v1/social-oauth`
}

export class YouTubeProvider implements SocialProvider {
  readonly platform: SocialPlatform = 'youtube'
  readonly displayName = 'YouTube'

  isConfigured(): boolean {
    return CLIENT_ID.length > 0
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      scope: SCOPES,
      response_type: 'code',
      // Google only issues a refresh token on the *first* consent unless asked
      // to prompt again. Without both of these, a creator who reconnects gets
      // an access token that dies in an hour and no way to renew it, and the
      // nightly sync starts failing a day later with a valid-looking row.
      access_type: 'offline',
      prompt: 'consent',
      // Ties the callback to the workspace that started it. The edge function
      // refuses a callback whose state it did not issue, which is what stops
      // someone else's authorisation landing in this workspace.
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  async fetchStats(accountId: string): Promise<FetchedStats> {
    const { data, error } = await supabase.functions.invoke('social-sync', {
      body: { action: 'stats', platform: 'youtube', accountId },
    })
    if (error) throw error
    if (!data?.stats) throw new Error('YouTube returned no figures for this channel')
    return data.stats as FetchedStats
  }

  async fetchPostStats(accountId: string, postUrl: string): Promise<FetchedPostStats | null> {
    const { data, error } = await supabase.functions.invoke('social-sync', {
      body: { action: 'post', platform: 'youtube', accountId, postUrl },
    })
    // Null rather than throwing: a private video, a deleted one, or a URL the
    // channel does not own are all normal, and the caller falls back to
    // whatever the creator entered by hand.
    if (error) return null
    return (data?.post ?? null) as FetchedPostStats | null
  }
}
