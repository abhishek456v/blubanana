import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import * as WebBrowser from 'expo-web-browser'
import {
  beginOAuthConnect,
  connectAccount,
  getProvider,
  disconnectAccount,
  getSocialAccounts,
  getStatHistory,
  mockedPlatformNames,
  summarizeReach,
  syncAccount,
  type ReachSummary,
  type SocialAccount,
  type SocialPlatform,
} from '@/lib/social'
import { formatCount } from '@/lib/performance'
import { formatRelativeDay } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useFeatureFlag } from '@/hooks/useFeatureFlags'
import { Button, Card, PressableScale, Skeleton, Sparkline, useConfirm, useToast } from '@/components/ui'

const PLATFORMS: { key: SocialPlatform; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
]

/**
 * Connect / disconnect the creator's own Instagram and YouTube.
 *
 * The reach figures this pulls are what make the "your audience grew and your
 * rate didn't" nudge possible; that sentence cannot be written from a
 * follower count typed in by hand four months ago.
 *
 * Nothing is ever posted. Read-only, and the copy says so, because asking a
 * creator to connect their livelihood account needs to be obviously safe.
 */
export function ConnectedAccounts() {
  const { c } = useTheme()
  // Turned off from the dashboard on the evening one of them breaks, rather
  // than shipping a release to every phone to hide a button.
  const instagramOn = useFeatureFlag('instagram')
  const youtubeOn = useFeatureFlag('youtube')
  const platforms = PLATFORMS.filter(({ key }) =>
    key === 'instagram' ? instagramOn : key === 'youtube' ? youtubeOn : true
  )
  const toast = useToast()
  const confirm = useConfirm()

  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [reach, setReach] = useState<Partial<Record<SocialPlatform, ReachSummary>>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<SocialPlatform | null>(null)

  const load = useCallback(async () => {
    try {
      const rows = await getSocialAccounts()
      setAccounts(rows)

      const summaries: Partial<Record<SocialPlatform, ReachSummary>> = {}
      for (const account of rows) {
        summaries[account.platform] = summarizeReach(await getStatHistory(account.platform))
      }
      setReach(summaries)
    } catch {
      // Non-fatal: the section renders as "not connected" rather than blocking
      // the rest of the You screen.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Two paths, chosen by whether the platform has real credentials.
   *
   * With them, this opens Meta's consent screen in a browser and the edge
   * function writes the account when the redirect lands — so nothing is
   * "connected" here, and the list refreshes when she comes back to the app.
   * Without them, the mock connects immediately, which is what keeps the whole
   * feature demonstrable before app review comes through.
   */
  async function handleConnect(platform: SocialPlatform) {
    setBusy(platform)
    try {
      if (getProvider(platform).isConfigured()) {
        const url = await beginOAuthConnect(platform)
        await WebBrowser.openBrowserAsync(url)
        // She may have approved, declined, or closed the tab. Reloading is the
        // only honest way to find out which.
        await load()
      } else {
        await connectAccount(platform)
        await load()
        toast(`${platform === 'instagram' ? 'Instagram' : 'YouTube'} connected`, { tone: 'success' })
      }
    } catch {
      toast('Could not connect that account', { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  async function handleSync(account: SocialAccount) {
    setBusy(account.platform)
    try {
      const updated = await syncAccount(account)
      await load()
      if (updated.status === 'error') {
        toast('Could not refresh. Reconnect the account', { tone: 'warning' })
      } else {
        toast('Stats refreshed', { tone: 'success' })
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleDisconnect(account: SocialAccount) {
    const confirmed = await confirm({
      title: `Disconnect ${account.handle}?`,
      message:
        'Your past stats are kept, so existing rate comparisons stay accurate. You can reconnect any time.',
      confirmLabel: 'Disconnect',
      destructive: true,
    })
    if (!confirmed) return

    try {
      await disconnectAccount(account.id)
      await load()
      toast('Disconnected', { tone: 'neutral' })
    } catch {
      toast('Could not disconnect', { tone: 'error' })
    }
  }

  if (loading) {
    return (
      <Card>
        <Skeleton height={20} width="45%" />
        <View style={styles.loadingRows}>
          <Skeleton height={58} radius={Radius.sm} />
          <Skeleton height={58} radius={Radius.sm} />
        </View>
      </Card>
    )
  }

  /*
   * Only about platforms that are actually on the screen.
   *
   * With the Instagram switch off, this said "Instagram shows sample data"
   * above a list with no Instagram in it: a warning about something the reader
   * cannot see, which is worse than no warning, because it invites them to
   * look for a row that is deliberately not there.
   */
  const shownNames = new Set<string>(
    platforms.map(({ key }) => (key === 'instagram' ? 'Instagram' : 'YouTube'))
  )
  const mocked = mockedPlatformNames().filter((name) => shownNames.has(name))

  return (
    <Card>
      <Text style={[styles.title, { color: c.textPrimary }]}>Your accounts</Text>
      <Text style={[styles.hint, { color: c.textSecondary }]}>
        Connect to track how your reach moves against your rates. Read-only, so Blubanana never
        posts anything.
      </Text>

      {/* Sample data must announce itself, and must name which platform it
          applies to: the two go live independently, so "some of this is
          invented" without saying which half is worse than useless. */}
      {mocked.length > 0 ? (
        <View style={[styles.notice, { backgroundColor: c.warningLight }]}>
          <Ionicons name="flask-outline" size={15} color={c.warning} />
          <Text style={[styles.noticeText, { color: c.warning }]}>
            {mocked.join(' and ')} {mocked.length === 1 ? 'shows' : 'show'} sample data. Real
            figures switch on once app review is approved.
          </Text>
        </View>
      ) : null}

      <Animated.View layout={LinearTransition.duration(200)} style={styles.list}>
        {platforms.map(({ key, label, icon }) => {
          const account = accounts.find((a) => a.platform === key)
          const summary = reach[key]

          return (
            <Animated.View key={key} entering={FadeIn.duration(180)}>
              <View style={[styles.row, { backgroundColor: c.bgPage }]}>
                <View style={[styles.icon, { backgroundColor: c.bgSurface }]}>
                  <Ionicons
                    name={icon}
                    size={19}
                    color={account ? c.accent : c.textMuted}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={1}>
                    {account ? `@${account.handle}` : label}
                  </Text>

                  {account ? (
                    <Text style={[styles.rowMeta, { color: c.textSecondary }]} numberOfLines={1}>
                      {summary?.followers != null
                        ? `${formatCount(summary.followers)} followers`
                        : label}
                      {summary?.growthPercent != null
                        ? ` · ${summary.growthPercent >= 0 ? '+' : ''}${summary.growthPercent.toFixed(1)}%`
                        : ''}
                      {account.last_synced_at
                        ? ` · ${formatRelativeDay(account.last_synced_at.slice(0, 10)).toLowerCase()}`
                        : ''}
                    </Text>
                  ) : (
                    <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
                      Not connected
                    </Text>
                  )}

                  {account?.status === 'error' ? (
                    <Text style={[styles.rowMeta, { color: c.danger }]} numberOfLines={1}>
                      Needs reconnecting
                    </Text>
                  ) : null}
                </View>

                {summary && summary.series.length > 2 ? (
                  <Sparkline values={summary.series} width={56} height={28} showEndPoint={false} />
                ) : null}

                {account ? (
                  <View style={styles.actions}>
                    <PressableScale
                      onPress={() => handleSync(account)}
                      disabled={busy === key}
                      hitSlop={8}
                      accessibilityLabel={`Refresh ${label}`}
                    >
                      <Ionicons
                        name="refresh"
                        size={17}
                        color={busy === key ? c.textMuted : c.textSecondary}
                      />
                    </PressableScale>
                    <PressableScale
                      onPress={() => handleDisconnect(account)}
                      hitSlop={8}
                      accessibilityLabel={`Disconnect ${label}`}
                    >
                      <Ionicons name="close-circle-outline" size={17} color={c.textMuted} />
                    </PressableScale>
                  </View>
                ) : (
                  <Button
                    label="Connect"
                    size="sm"
                    variant="secondary"
                    loading={busy === key}
                    onPress={() => handleConnect(key)}
                  />
                )}
              </View>
            </Animated.View>
          )
        })}
      </Animated.View>
    </Card>
  )
}

const styles = StyleSheet.create({
  title: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  hint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.xxs,
    lineHeight: 18,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
    marginTop: Spacing.md,
  },
  noticeText: {
    flex: 1,
    ...Typography.label,
    fontFamily: FontFamily.medium,
    lineHeight: 16,
  },
  loadingRows: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  list: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
  rowMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
})
