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
// Requires META_APP_ID and META_APP_SECRET as function secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAPH = 'https://graph.facebook.com/v21.0'

/** A plain page, because a human is looking at this in a browser tab. */
function page(title: string, detail: string, ok: boolean): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8" />
     <meta name="viewport" content="width=device-width,initial-scale=1" />
     <title>${title}</title></head>
     <body style="margin:0;display:flex;align-items:center;justify-content:center;
                  min-height:100vh;background:#08080C;color:#fff;
                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
       <div style="max-width:420px;padding:32px;text-align:center">
         <div style="font-size:34px;margin-bottom:14px">${ok ? '✅' : '⚠️'}</div>
         <h1 style="font-size:19px;margin:0 0 10px">${title}</h1>
         <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,.62);margin:0">${detail}</p>
       </div>
     </body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  // Meta sends the user back here when they decline, too.
  if (url.searchParams.get('error')) {
    return page('Not connected', 'You cancelled, so nothing was changed. You can close this tab.', false)
  }
  if (!code || !state) {
    return page('Something is missing', 'That link did not carry an authorisation code.', false)
  }

  const appId = Deno.env.get('META_APP_ID')
  const appSecret = Deno.env.get('META_APP_SECRET')
  if (!appId || !appSecret) {
    console.error('social-oauth: META_APP_ID / META_APP_SECRET not set')
    return page('Not configured yet', 'Instagram is not set up on this server.', false)
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
      .select('workspace_id')
      .maybeSingle()

    if (stateError) throw stateError
    if (!stateRow) {
      return page(
        'That link has expired',
        'Start the connection again from the app. Links are single-use and last a few minutes.',
        false
      )
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-oauth`

    // ── 2. Code → short-lived token → long-lived token ───────────────────────
    const shortRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`
    )
    const short = await shortRes.json()
    if (!shortRes.ok || !short.access_token) {
      console.error('social-oauth: exchange failed', short)
      return page('Could not connect', 'Instagram refused the authorisation. Please try again.', false)
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
      return page(
        'No Instagram professional account',
        'This Facebook account has no Instagram business or creator account linked to a Page. ' +
          'Instagram only exposes insights for those.',
        false
      )
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

    return page(
      `Connected @${ig.username}`,
      'Your reach and view counts will refresh daily. You can close this tab and go back to the app.',
      true
    )
  } catch (error) {
    console.error('social-oauth failed', error)
    return page('Could not connect', 'Something went wrong on our side. Please try again.', false)
  }
})
