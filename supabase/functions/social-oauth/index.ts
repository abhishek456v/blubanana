// Deno edge function. Deploy with: supabase functions deploy social-oauth
//
// The Instagram OAuth redirect target. Meta sends the browser here with a
// `code`; this exchanges it for a long-lived token, resolves which Instagram
// professional account it belongs to, and writes the row. The client never
// sees a token — migration 013 revokes those columns from `authenticated`
// precisely so it cannot.
//
// ── Authentication ──────────────────────────────────────────────────────────
//
// This endpoint is opened by Meta's redirect, in a browser, with no session.
// It therefore runs with verify_jwt = false (see config.toml) and authenticates
// on the `state` nonce instead: the app inserts a row in `oauth_states` before
// opening the dialog, and this consumes it. A callback whose state we did not
// issue, or which has already been used, is refused — otherwise anyone could
// hand us a code and have the resulting account land in someone's workspace.
//
// Requires META_APP_ID / META_APP_SECRET for Instagram, and GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET for YouTube, as function secrets. Either pair is enough
// on its own: the two networks are reviewed by two companies on two timetables,
// so each path checks only its own credentials.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAPH = 'https://graph.facebook.com/v21.0'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const YT = 'https://www.googleapis.com/youtube/v3'

/**
 * The YouTube half of the callback.
 *
 * Differs from Instagram in the one way that matters operationally: Google's
 * access token lasts an hour, so what gets stored is the **refresh** token.
 * The sync function trades it for a fresh access token on every run. Meta's
 * Page tokens do not expire, so that file stores the access token directly.
 *
 * `admin` is passed in rather than re-created so both paths share one client.
 */
async function connectYouTube(
  admin: ReturnType<typeof createClient>,
  workspaceId: string,
  code: string,
  redirectUri: string
): Promise<Response> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    console.error('social-oauth: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set')
    return back('notconfigured', 'YouTube')
  }

  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  if (!tokenRes.ok || !tokens.access_token) {
    console.error('social-oauth: google exchange failed', tokens?.error)
    return back('refused', 'YouTube')
  }

  // No refresh token means Google treated this as a repeat consent and the
  // daily sync would die in an hour with a row that looks connected. The
  // provider sends prompt=consent to prevent it; failing loudly here is what
  // stops that becoming a silent outage if the parameter is ever dropped.
  if (!tokens.refresh_token) {
    return back('norefresh')
  }

  const channelRes = await fetch(`${YT}/channels?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const channelBody = await channelRes.json()
  const channel = channelBody.items?.[0]

  if (!channel) {
    return back('nochannel')
  }

  const handle: string =
    channel.snippet?.customUrl?.replace(/^@/, '') ?? channel.snippet?.title ?? 'channel'

  const { error } = await admin.from('social_accounts').upsert(
    {
      workspace_id: workspaceId,
      platform: 'youtube',
      handle,
      external_account_id: channel.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      scopes: ['youtube.readonly'],
      status: 'active',
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,platform,handle' }
  )
  if (error) throw error

  return back('connected', handle)
}

/** A plain page, because a human is looking at this in a browser tab. */
/** Where the creator came from, and where every ending sends them back to. */
const APP_URL = Deno.env.get('APP_URL') ?? 'https://platform.blubanana.in'

/**
 * What happened, as something the app can read.
 *
 * Codes rather than prose: the wording belongs in the app with the rest of
 * the copy, not in a query string assembled on a server.
 */
type Outcome =
  | 'connected'
  | 'cancelled'
  | 'nocode'
  | 'expired'
  | 'notconfigured'
  | 'refused'
  | 'norefresh'
  | 'nochannel'
  | 'noaccount'
  | 'failed'

/**
 * Send the browser back to the app.
 *
 * This used to render a small HTML page saying what happened, and it could
 * not work: Supabase rewrites text/html to text/plain and adds nosniff on the
 * functions domain, so the "Connected" page arrived as its own source code
 * with the tick mark mojibaked into "âœ…". No response header changes that,
 * because the rewrite happens above the function.
 *
 * Redirecting is the better ending anyway. The creator opened this from the
 * app and now lands back in it, instead of being left on a supabase.co URL
 * being told to close the tab.
 *
 * `detail` carries the channel handle on success, and the platform name when
 * a platform is not configured, so the app can name what it is talking about.
 */
function back(outcome: Outcome, detail = ''): Response {
  const url = new URL(`${APP_URL}/settings`)
  url.searchParams.set('social', outcome)
  if (detail) url.searchParams.set('detail', detail)
  return Response.redirect(url.toString(), 303)
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  // Meta sends the user back here when they decline, too.
  if (url.searchParams.get('error')) {
    return back('cancelled')
  }
  if (!code || !state) {
    return back('nocode')
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // ── 1. Consume the state ─────────────────────────────────────────────────
    // Deleted on read, so a replayed callback finds nothing. The returning row
    // is what tells us which workspace asked.
    const { data: stateRow, error: stateError } = await admin
      .from('oauth_states')
      .delete()
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .select('workspace_id, platform')
      .maybeSingle()

    if (stateError) throw stateError
    if (!stateRow) {
      return back('expired')
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-oauth`

    // Which network this callback belongs to comes from the state row, not
    // from sniffing the query string. Both providers redirect here, and
    // Google's `scope` parameter happens to distinguish them today, which is
    // exactly the kind of thing that stops being true after an API update.
    if (stateRow.platform === 'youtube') {
      return await connectYouTube(admin, stateRow.workspace_id, code, redirectUri)
    }

    // Checked here rather than at the top of the handler.
    //
    // It used to run before the state was even read, which meant a *YouTube*
    // callback on a server with no Meta credentials was turned away with
    // "Instagram is not set up on this server" and never reached the branch
    // above. The two networks go live independently by design, so neither may
    // gate the other: this is the Instagram path, so this is where Instagram's
    // credentials are required.
    const appId = Deno.env.get('META_APP_ID')
    const appSecret = Deno.env.get('META_APP_SECRET')
    if (!appId || !appSecret) {
      console.error('social-oauth: META_APP_ID / META_APP_SECRET not set')
      return back('notconfigured', 'Instagram')
    }

    // ── 2. Code → short-lived token → long-lived token ───────────────────────
    const shortRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`
    )
    const short = await shortRes.json()
    if (!shortRes.ok || !short.access_token) {
      console.error('social-oauth: exchange failed', short)
      return back('refused', 'Instagram')
    }

    // A short-lived token dies in about an hour, which would mean reconnecting
    // before the first daily sync ever ran.
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}` +
        `&client_secret=${appSecret}&fb_exchange_token=${short.access_token}`
    )
    const long = await longRes.json()
    const token: string = long.access_token ?? short.access_token
    const expiresIn: number = long.expires_in ?? 60 * 60

    // ── 3. Page → Instagram professional account ─────────────────────────────
    // Meta exposes an Instagram professional account only through the Facebook
    // Page it is linked to. There is no endpoint that skips this hop.
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=instagram_business_account{id,username},access_token&access_token=${token}`
    )
    const pages = await pagesRes.json()
    const linked = (pages.data ?? []).find(
      (p: Record<string, unknown>) => p.instagram_business_account
    )

    if (!linked) {
      return back('noaccount')
    }

    const ig = linked.instagram_business_account as { id: string; username: string }

    // ── 4. Store it ──────────────────────────────────────────────────────────
    // The Page token, not the user token: Page tokens derived from a
    // long-lived user token do not expire, which is what stops the daily sync
    // silently dying two months from now.
    const { error: upsertError } = await admin.from('social_accounts').upsert(
      {
        workspace_id: stateRow.workspace_id,
        platform: 'instagram',
        handle: ig.username,
        external_account_id: ig.id,
        access_token: linked.access_token ?? token,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        scopes: ['instagram_basic', 'instagram_manage_insights'],
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,platform,handle' }
    )
    if (upsertError) throw upsertError

    return back('connected', ig.username)
  } catch (error) {
    console.error('social-oauth failed', error)
    return back('failed')
  }
})
