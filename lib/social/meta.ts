import { supabase } from '../supabase'
import type {
  FetchedPostStats,
  FetchedStats,
  SocialPlatform,
  SocialProvider,
} from './types'

// Instagram, through the Meta Graph API.
//
// ── Why almost nothing happens in this file ─────────────────────────────────
//
// Every Graph call needs an access token, and migration 013 revokes the token
// columns from `authenticated` precisely so the client can never hold one. So
// this provider is a thin caller: it asks the `social-sync` edge function,
// which reads the token with the service role and talks to Meta. The interface
// in `types.ts` is satisfied exactly as the mock satisfies it, which is what
// lets `PROVIDERS` swap one for the other without a screen changing.
//
// ── What "configured" means ─────────────────────────────────────────────────
//
// The app id is public and ships in the bundle; the app *secret* is a function
// secret and never leaves the server. `isConfigured()` therefore tests the
// public half only — which is the right test, because it is what decides
// whether the app can start an OAuth flow at all. A missing secret surfaces
// server-side, as a failed exchange, rather than as a button that does nothing.

const APP_ID = process.env.EXPO_PUBLIC_META_APP_ID ?? ''

/**
 * Scopes for a creator's own professional account.
 *
 * `instagram_manage_insights` is the one that matters: without it the API
 * returns a profile with no reach figures, which looks identical to a creator
 * who has no reach. `pages_show_list` and `business_management` are required
 * because an Instagram professional account is reached through the Facebook
 * Page it is linked to — Meta has no path to it that skips the Page.
 */
const SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
].join(',')

/** Meta requires the redirect to match the app config exactly, so it is derived, never typed. */
function redirectUri(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
  return `${base}/functions/v1/social-oauth`
}

export class MetaGraphProvider implements SocialProvider {
  readonly platform: SocialPlatform = 'instagram'
  readonly displayName = 'Instagram'

  isConfigured(): boolean {
    return APP_ID.length > 0
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: APP_ID,
      redirect_uri: redirectUri(),
      scope: SCOPES,
      response_type: 'code',
      // Ties the callback to the workspace that started it. The edge function
      // refuses a callback whose state it did not issue, which is what stops
      // someone else's authorisation landing in this workspace.
      state,
    })
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  }

  async fetchStats(accountId: string): Promise<FetchedStats> {
    const { data, error } = await supabase.functions.invoke('social-sync', {
      body: { action: 'stats', accountId },
    })
    if (error) throw error
    if (!data?.stats) throw new Error('Instagram returned no figures for this account')
    return data.stats as FetchedStats
  }

  async fetchPostStats(accountId: string, postUrl: string): Promise<FetchedPostStats | null> {
    const { data, error } = await supabase.functions.invoke('social-sync', {
      body: { action: 'post', accountId, postUrl },
    })
    // Null rather than throwing: an unlisted post, a deleted one, or a URL the
    // account does not own are all normal, and the caller falls back to
    // whatever the creator entered by hand.
    if (error) return null
    return (data?.post ?? null) as FetchedPostStats | null
  }
}
