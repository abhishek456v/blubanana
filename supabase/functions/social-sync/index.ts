// Deno edge function. Deploy with: supabase functions deploy social-sync
//
// Everything that needs an Instagram access token. Three jobs:
//
//   stats  — reach for one account, called when the app connects or refreshes
//   post   — insights for one published post, by its permalink
//   cron   — the nightly pass: a snapshot per account, and view counts written
//            back onto the deliverables that carry a live link
//
// The nightly pass is what makes cost per view real. §8.11 wants CPV on the
// card, and CPV needs a view count per deliverable — a number no creator is
// going to type in for every post she has ever published.
//
// ── Authentication ──────────────────────────────────────────────────────────
//
// verify_jwt = false (config.toml), because pg_cron has no session. It then
// authenticates every request itself: either the shared CRON_SECRET, or a real
// user JWT resolved through getUser(). Unauthenticated requests reach nothing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAPH = 'https://graph.facebook.com/v21.0'

interface Body {
  action?: 'stats' | 'post' | 'cron'
  accountId?: string
  postUrl?: string
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    },
  })

/** Reach figures for one Instagram account. */
async function fetchStats(igId: string, token: string) {
  const profileRes = await fetch(
    `${GRAPH}/${igId}?fields=username,followers_count,follows_count,media_count&access_token=${token}`
  )
  const profile = await profileRes.json()
  if (!profileRes.ok) throw new Error(profile?.error?.message ?? 'Instagram refused the request')

  // Engagement is derived from recent posts rather than taken from a field,
  // because Instagram exposes no account-level engagement rate. Twenty-five
  // posts is enough to be stable and few enough to stay inside one page.
  const mediaRes = await fetch(
    `${GRAPH}/${igId}/media?fields=like_count,comments_count&limit=25&access_token=${token}`
  )
  const media = await mediaRes.json()
  const posts: { like_count?: number; comments_count?: number }[] = media.data ?? []

  const followers: number | null = profile.followers_count ?? null
  let engagementRate: number | null = null
  let avgLikes: number | null = null

  if (posts.length > 0 && followers && followers > 0) {
    const likes = posts.reduce((sum, p) => sum + (p.like_count ?? 0), 0)
    const comments = posts.reduce((sum, p) => sum + (p.comments_count ?? 0), 0)
    avgLikes = Math.round(likes / posts.length)
    // Percentage, matching FetchedStats' documented unit.
    engagementRate = ((likes + comments) / posts.length / followers) * 100
  }

  return {
    handle: profile.username ?? '',
    externalAccountId: igId,
    followers,
    following: profile.follows_count ?? null,
    postsCount: profile.media_count ?? null,
    avgViews: null,
    avgLikes,
    engagementRate,
  }
}

/** Every recent post's permalink and its view count, for matching against live links. */
async function fetchRecentMedia(igId: string, token: string) {
  const out: { id: string; permalink: string; views: number | null; likes: number | null;
               comments: number | null; saves: number | null; reach: number | null }[] = []
  let next =
    `${GRAPH}/${igId}/media?fields=id,permalink,media_product_type,like_count,comments_count,` +
    `insights.metric(reach,saved,views)&limit=50&access_token=${token}`

  // Three pages at most. A creator with 900 posts should not make the nightly
  // job walk all of them; the ones with live links on active deals are recent.
  for (let pageCount = 0; pageCount < 3 && next; pageCount++) {
    const res = await fetch(next)
    const body = await res.json()
    if (!res.ok) break

    for (const item of body.data ?? []) {
      const insights: { name: string; values?: { value?: number }[] }[] =
        item.insights?.data ?? []
      const metric = (name: string) =>
        insights.find((i) => i.name === name)?.values?.[0]?.value ?? null

      out.push({
        id: item.id,
        permalink: item.permalink ?? '',
        views: metric('views'),
        likes: item.like_count ?? null,
        comments: item.comments_count ?? null,
        saves: metric('saved'),
        reach: metric('reach'),
      })
    }
    next = body.paging?.next ?? ''
  }
  return out
}

/**
 * Two permalinks for the same post are not string-equal.
 *
 * A creator pastes `https://www.instagram.com/reel/ABC123/?igsh=xyz` and the
 * API returns `https://www.instagram.com/p/ABC123/`. The shortcode is the only
 * stable part, so that is what is compared.
 */
function shortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i)
  return match ? match[1] : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })

  const cronSecret = Deno.env.get('CRON_SECRET')
  const isCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret

  let callerWorkspaces: string[] | null = null
  if (!isCron) {
    const auth = req.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Not authenticated' }, 401)

    const { data: userData } = await admin.auth.getUser(auth.replace('Bearer ', ''))
    if (!userData?.user) return json({ error: 'Not authenticated' }, 401)

    // Scopes every lookup below to workspaces this caller actually belongs to.
    // Without it, an accountId from another workspace would be synced — and the
    // response would carry that creator's follower count back.
    const { data: memberships } = await admin
      .from('memberships')
      .select('workspace_id')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
    callerWorkspaces = (memberships ?? []).map((m) => m.workspace_id as string)
    if (callerWorkspaces.length === 0) return json({ error: 'No workspace' }, 403)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body
    const action = body.action ?? (isCron ? 'cron' : 'stats')

    // ── One account, on demand ───────────────────────────────────────────────
    if (action === 'stats' || action === 'post') {
      let query = admin
        .from('social_accounts')
        .select('id, workspace_id, external_account_id, access_token')
        .eq('platform', 'instagram')
        .eq('status', 'active')

      if (body.accountId) query = query.eq('id', body.accountId)
      if (callerWorkspaces) query = query.in('workspace_id', callerWorkspaces)

      const { data: account } = await query.limit(1).maybeSingle()
      if (!account?.access_token || !account.external_account_id) {
        return json({ error: 'No connected Instagram account' }, 404)
      }

      if (action === 'stats') {
        const stats = await fetchStats(account.external_account_id, account.access_token)
        await admin.from('creator_stat_snapshots').upsert(
          {
            workspace_id: account.workspace_id,
            social_account_id: account.id,
            platform: 'instagram',
            captured_on: new Date().toISOString().slice(0, 10),
            followers: stats.followers,
            following: stats.following,
            posts_count: stats.postsCount,
            avg_likes: stats.avgLikes,
            engagement_rate: stats.engagementRate,
            source: 'api',
          },
          // Must name all four columns of 013's unique constraint; a shorter list
          // matches no constraint and the upsert is rejected.
          { onConflict: 'workspace_id,platform,captured_on,social_account_id' }
        )
        await admin
          .from('social_accounts')
          .update({ last_synced_at: new Date().toISOString(), last_error: null })
          .eq('id', account.id)

        return json({ stats })
      }

      const wanted = shortcode(body.postUrl ?? '')
      if (!wanted) return json({ post: null })

      const media = await fetchRecentMedia(account.external_account_id, account.access_token)
      const match = media.find((m) => shortcode(m.permalink) === wanted)
      return json({
        post: match
          ? {
              views: match.views,
              likes: match.likes,
              comments: match.comments,
              shares: null,
              saves: match.saves,
              reach: match.reach,
            }
          : null,
      })
    }

    // ── The nightly pass ─────────────────────────────────────────────────────
    if (!isCron) return json({ error: 'The full sync runs on a schedule' }, 403)

    const { data: accounts } = await admin
      .from('social_accounts')
      .select('id, workspace_id, external_account_id, access_token')
      .eq('platform', 'instagram')
      .eq('status', 'active')

    let snapshots = 0
    let updated = 0

    for (const account of accounts ?? []) {
      if (!account.access_token || !account.external_account_id) continue

      try {
        const stats = await fetchStats(account.external_account_id, account.access_token)
        await admin.from('creator_stat_snapshots').upsert(
          {
            workspace_id: account.workspace_id,
            social_account_id: account.id,
            platform: 'instagram',
            captured_on: new Date().toISOString().slice(0, 10),
            followers: stats.followers,
            following: stats.following,
            posts_count: stats.postsCount,
            avg_likes: stats.avgLikes,
            engagement_rate: stats.engagementRate,
            source: 'api',
          },
          // Must name all four columns of 013's unique constraint; a shorter list
          // matches no constraint and the upsert is rejected.
          { onConflict: 'workspace_id,platform,captured_on,social_account_id' }
        )
        snapshots++

        // View counts back onto the deliverables. This is the half that makes
        // cost per view exist: rate ÷ views, per line item.
        const media = await fetchRecentMedia(account.external_account_id, account.access_token)
        const byShortcode = new Map(
          media.map((m) => [shortcode(m.permalink) ?? m.id, m])
        )

        const { data: deliverables } = await admin
          .from('deal_deliverables')
          .select('id, live_link')
          .eq('workspace_id', account.workspace_id)
          .not('live_link', 'is', null)

        for (const deliverable of deliverables ?? []) {
          const key = shortcode(deliverable.live_link as string)
          const found = key ? byShortcode.get(key) : undefined
          if (!found) continue

          await admin
            .from('deal_deliverables')
            .update({
              views: found.views,
              likes: found.likes,
              comments: found.comments,
              saves: found.saves,
              reach: found.reach,
              performance_updated_at: new Date().toISOString(),
            })
            .eq('id', deliverable.id)
          updated++
        }

        await admin
          .from('social_accounts')
          .update({ last_synced_at: new Date().toISOString(), last_error: null })
          .eq('id', account.id)
      } catch (error) {
        // One creator's expired token must not stop everyone else's sync.
        // Recorded on the row, which the UI surfaces as "reconnect".
        console.error('social-sync: account failed', account.id, error)
        await admin
          .from('social_accounts')
          .update({
            status: 'error',
            last_error: error instanceof Error ? error.message.slice(0, 300) : 'Sync failed',
          })
          .eq('id', account.id)
      }
    }

    return json({ snapshots, deliverablesUpdated: updated })
  } catch (error) {
    console.error('social-sync failed', error)
    return json({ error: 'Sync failed' }, 500)
  }
})
