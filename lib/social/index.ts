import { supabase } from '../supabase'
import { getWorkspaceId } from '../workspace'
import { MockSocialProvider } from './mock'
import type {
  SocialAccount,
  SocialPlatform,
  SocialProvider,
  StatSnapshot,
} from './types'

export * from './types'

// The columns the app is allowed to read. Deliberately explicit rather than
// `select('*')`: migration 013 revokes column-level select on the token
// columns, so a wildcard would be rejected by Postgres. Listing them keeps the
// failure at code-review time instead of runtime.
const ACCOUNT_COLUMNS =
  'id, workspace_id, platform, handle, external_account_id, token_expires_at, scopes, status, last_synced_at, last_error, created_at, updated_at'

/**
 * Which implementation backs each platform.
 *
 * Both are mocks today. When Meta and Google app review come through, this map
 * is the only thing that changes; every caller goes through the interface, so
 * no screen or service is touched.
 */
const PROVIDERS: Record<SocialPlatform, SocialProvider> = {
  instagram: new MockSocialProvider('instagram'),
  youtube: new MockSocialProvider('youtube'),
}

export function getProvider(platform: SocialPlatform): SocialProvider {
  return PROVIDERS[platform]
}

/**
 * True while the mock providers are in use.
 *
 * The UI reads this to label connected accounts as sample data. Showing a
 * creator invented follower numbers without saying so would make the app look
 * like it is lying the moment they compare against their real profile.
 */
export function isUsingMockProviders(): boolean {
  return Object.values(PROVIDERS).every((p) => p instanceof MockSocialProvider)
}

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  const { data, error } = await supabase
    .from('social_accounts')
    .select(ACCOUNT_COLUMNS)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as SocialAccount[]
}

/**
 * Connects an account and takes the first snapshot.
 *
 * With a real provider this runs *after* the OAuth redirect has been handled
 * server-side and a token row already exists; here it creates the row itself.
 * Either way the app only ever writes the non-secret columns.
 */
export async function connectAccount(platform: SocialPlatform): Promise<SocialAccount> {
  const workspaceId = await getWorkspaceId()
  const provider = getProvider(platform)

  const stats = await provider.fetchStats(`${workspaceId}:${platform}`)

  const { data, error } = await supabase
    .from('social_accounts')
    .upsert(
      {
        workspace_id: workspaceId,
        platform,
        handle: stats.handle,
        external_account_id: stats.externalAccountId,
        status: 'active',
        last_synced_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: 'workspace_id,platform,handle' }
    )
    .select(ACCOUNT_COLUMNS)
    .single()

  if (error) throw error
  const account = data as unknown as SocialAccount

  await recordSnapshot(workspaceId, account, stats)
  return account
}

export async function disconnectAccount(accountId: string): Promise<void> {
  // Deleted rather than marked revoked: a creator who disconnects expects the
  // connection gone. Stat history survives via `on delete set null`, so past
  // benchmarks are not silently rewritten.
  const { error } = await supabase.from('social_accounts').delete().eq('id', accountId)
  if (error) throw error
}

/** Re-reads the platform and stores today's snapshot. */
export async function syncAccount(account: SocialAccount): Promise<SocialAccount> {
  const workspaceId = await getWorkspaceId()
  const provider = getProvider(account.platform)

  try {
    const stats = await provider.fetchStats(account.external_account_id ?? account.id)
    await recordSnapshot(workspaceId, account, stats)

    const { data, error } = await supabase
      .from('social_accounts')
      .update({
        handle: stats.handle,
        status: 'active',
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', account.id)
      .select(ACCOUNT_COLUMNS)
      .single()

    if (error) throw error
    return data as unknown as SocialAccount
  } catch (err) {
    // A failed sync is recorded on the row, not thrown at the screen. Token
    // expiry is an expected state that resolves with a reconnect, and surfacing
    // it as an error toast would train the creator to ignore real problems.
    const message = err instanceof Error ? err.message : 'Sync failed'
    await supabase
      .from('social_accounts')
      .update({ status: 'error', last_error: message })
      .eq('id', account.id)

    return { ...account, status: 'error', last_error: message }
  }
}

/**
 * Writes one snapshot for today, replacing any earlier one from the same day.
 *
 * The unique constraint on (workspace, platform, day, account) is what keeps
 * this table bounded: syncing ten times in an afternoon updates one row
 * instead of adding ten.
 */
async function recordSnapshot(
  workspaceId: string,
  account: SocialAccount,
  stats: Awaited<ReturnType<SocialProvider['fetchStats']>>
): Promise<void> {
  const { error } = await supabase.from('creator_stat_snapshots').upsert(
    {
      workspace_id: workspaceId,
      social_account_id: account.id,
      platform: account.platform,
      captured_on: new Date().toISOString().slice(0, 10),
      followers: stats.followers,
      following: stats.following ?? null,
      posts_count: stats.postsCount ?? null,
      avg_views: stats.avgViews ?? null,
      avg_likes: stats.avgLikes ?? null,
      engagement_rate: stats.engagementRate,
      source: 'api',
    },
    { onConflict: 'workspace_id,platform,captured_on,social_account_id' }
  )
  if (error) throw error
}

/** Snapshots for one platform, oldest first: the shape a sparkline wants. */
export async function getStatHistory(
  platform: SocialPlatform,
  days = 90
): Promise<StatSnapshot[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('creator_stat_snapshots')
    .select('*')
    .eq('platform', platform)
    .gte('captured_on', since.toISOString().slice(0, 10))
    .order('captured_on', { ascending: true })

  if (error) throw error
  return (data ?? []) as StatSnapshot[]
}

export interface ReachSummary {
  followers: number | null
  engagementRate: number | null
  /** Percentage change in followers across the window, or null if unknowable. */
  growthPercent: number | null
  series: number[]
}

/**
 * Reduces the snapshot history to what a card needs.
 *
 * Growth is null rather than 0 when there is only one snapshot: a brand-new
 * connection has no trend, and printing "0% growth" would read as stagnation
 * rather than as absence of data.
 */
export function summarizeReach(snapshots: StatSnapshot[]): ReachSummary {
  const withFollowers = snapshots.filter((s) => s.followers != null)
  if (withFollowers.length === 0) {
    return { followers: null, engagementRate: null, growthPercent: null, series: [] }
  }

  const first = withFollowers[0].followers!
  const latest = withFollowers[withFollowers.length - 1]

  return {
    followers: latest.followers,
    engagementRate: latest.engagement_rate,
    growthPercent:
      withFollowers.length > 1 && first > 0
        ? ((latest.followers! - first) / first) * 100
        : null,
    series: withFollowers.map((s) => s.followers!),
  }
}
