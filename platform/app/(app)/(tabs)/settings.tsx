import { useCallback, useEffect, useState } from 'react'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { supabase } from '@/lib/supabase'
import { buildExport } from '@/lib/exportData'
import { deleteMyAccount } from '@/lib/account'
import { getProfile } from '@/lib/profile'
import {
  notificationsEnabledAsync,
  scheduledCountAsync,
  sendTestAsync,
} from '@/lib/notifications'
import { useAuth } from '@/hooks/useAuth'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useTheme, useThemeMode, type ThemeMode } from '@/hooks/useTheme'
import { BrandAvatar } from '@/components/BrandAvatar'
import { ConnectedAccounts } from '@/components/social/ConnectedAccounts'
import { TwoFactorCard } from '@/components/security/TwoFactorCard'
import { DeleteAccountSheet } from '@/components/DeleteAccountSheet'
import {
  ColumnGap,
  DesktopContentMaxWidth,
  FontFamily,
  HitSlop,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import {
  Button,
  Card,
  HeaderUtilities,
  ListRow,
  PressableScale,
  ScreenHeader,
  SegmentedControl,
  useConfirm,
  useToast,
} from '@/components/ui'

// Mirrors the header's ThemeToggle, but with the third option the toggle
// deliberately leaves out: a two-state control cannot express "follow the
// system", and that is the default the app ships with.
const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: 'Day' },
  { key: 'dark', label: 'Night' },
  { key: 'system', label: 'System' },
]
import type { Creator } from '@/types'

export default function YouScreen() {
  const { c } = useTheme()
  const router = useRouter()
  const { session } = useAuth()
  const { isDesktop } = useBreakpoint()
  const { mode, setMode } = useThemeMode()
  const toast = useToast()
  const confirm = useConfirm()
  const params = useLocalSearchParams<{ social?: string; detail?: string }>()

  /**
   * What the OAuth redirect came back saying.
   *
   * The edge function cannot tell the creator anything itself. Supabase
   * rewrites text/html to text/plain on the functions domain, so the page it
   * used to render arrived as raw source with a mojibaked tick. It sends a
   * short code back to this screen instead, and the wording lives here with
   * the rest of the app's copy.
   *
   * `reconnectHint` exists because two of these are fixable by the creator
   * and the rest are not, and a message that only says "could not connect"
   * leaves her with nothing to do next.
   */
  const [socialNotice, setSocialNotice] = useState<string | null>(null)

  useEffect(() => {
    const outcome = params.social
    if (!outcome) return

    const detail = params.detail ?? 'That account'
    const message: Record<string, string> = {
      connected: `${detail} is connected. Your figures refresh daily.`,
      cancelled: 'Not connected. You cancelled, so nothing changed.',
      nocode: 'That link did not carry an authorisation code. Please try again.',
      expired: 'That link had expired. Links last a few minutes, so start again.',
      notconfigured: `${detail} is not set up on this server yet.`,
      refused: `${detail} refused the authorisation. Please try again.`,
      norefresh:
        'Google did not give a lasting permission. Remove Blubanana from your Google account permissions, then connect again.',
      nochannel:
        'That Google account has no YouTube channel. Sign in with the account that owns the channel.',
      noaccount:
        'That Facebook account has no Instagram business or creator account linked to a Page. Instagram only shares figures for those.',
      failed: 'Something went wrong on our side. Please try again.',
    }

    const text = message[outcome] ?? 'Something went wrong. Please try again.'
    toast(text, { tone: outcome === 'connected' ? 'success' : 'error' })
    setSocialNotice(outcome === 'connected' ? null : text)

    // Cleared from the URL so a refresh does not replay the message, and so
    // the address bar stops showing the result of something already done.
    router.replace('/(app)/(tabs)/settings')
  }, [params.social, params.detail, toast, router])

  const [profile, setProfile] = useState<Creator | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notifPermission, setNotifPermission] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown'
  )
  const [scheduledCount, setScheduledCount] = useState(0)
  const [testState, setTestState] = useState<
    'idle' | 'sending' | 'scheduled' | 'denied' | 'failed'
  >('idle')

  const refreshNotificationState = useCallback(async () => {
    const enabled = await notificationsEnabledAsync()
    setNotifPermission(enabled ? 'granted' : 'denied')
    setScheduledCount(enabled ? await scheduledCountAsync() : 0)
  }, [])

  async function handleTestNotification() {
    setTestState('sending')
    const result = await sendTestAsync()
    setTestState(result === 'scheduled' ? 'scheduled' : result)
    refreshNotificationState()
  }

  const email = session?.user?.email ?? ''
  // Falls back to the auth session's name while the profiles row loads, so the
  // header isn't briefly blank on first render.
  const name = profile?.name || session?.user?.user_metadata?.name || 'Creator'

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await getProfile())
    } catch {
      // Non-fatal: falls back to session metadata for the name.
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadProfile()
      // Re-read on focus: the creator may have just flipped this in iOS
      // Settings and come straight back.
      refreshNotificationState()
    }, [loadProfile, refreshNotificationState])
  )

  /**
   * Hands the creator her whole workspace as a file.
   *
   * Shared rather than written to disk: Expo's sharing sheet is the one path
   * that works the same on iOS, Android and web, and a download the app writes
   * somewhere she cannot find is not portability.
   */
  /**
   * Deletes the account, then lets the auth listener route to sign-in.
   *
   * No success toast: the screen it would appear on is gone by the time it
   * would render, and a toast is the wrong register for this anyway. The
   * absence of the app is the confirmation.
   */
  async function handleDeleteAccount() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteMyAccount()
      setDeleteOpen(false)
    } catch {
      toast('Could not delete your account. Nothing has been removed.', { tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      const bundle = await buildExport()
      const json = JSON.stringify(bundle, null, 2)
      const name = `blubanana-export-${new Date().toISOString().slice(0, 10)}.json`

      if (Platform.OS === 'web') {
        // No filesystem to share from; hand it to the browser directly.
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
        const link = document.createElement('a')
        link.href = url
        link.download = name
        link.click()
        URL.revokeObjectURL(url)
      } else {
        const file = new File(Paths.cache, name)
        file.create({ overwrite: true })
        file.write(json)
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' })
      }
      toast('Export ready')
    } catch {
      toast('Could not build the export', { tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  async function handleSignOut() {
    if (!(await confirm({ title: 'Sign out?', confirmLabel: 'Sign out', destructive: true })))
      return
    await supabase.auth.signOut()
    // The root layout notices the cleared session and redirects to sign-in.
  }


  const followerLine =
    profile?.follower_count != null
      ? `${profile.follower_count.toLocaleString('en-IN')} followers`
      : null

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bgPage }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader style={styles.headerFlush} title="You" leadingAction={<HeaderUtilities />} />

        <View style={isDesktop ? styles.columns : styles.stack}>
          <View style={isDesktop ? styles.column : undefined}>
        <Card onPress={() => router.push('/(app)/profile/edit' as never)} style={styles.profileCard}>
          <BrandAvatar name={name} size={52} />
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: c.textPrimary }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.profileMeta, { color: c.textMuted }]} numberOfLines={1}>
              {email}
            </Text>
            {profile?.phone || followerLine ? (
              <Text style={[styles.profileMeta, { color: c.textMuted }]} numberOfLines={1}>
                {[profile?.phone, followerLine].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </Card>

        {/* Kept on screen rather than left to the toast. She has just come
            back from a browser tab, and a message that fades after three
            seconds is one she is likely to arrive too late to read. */}
        {socialNotice ? (
          <View style={[styles.socialNotice, { backgroundColor: c.dangerLight }]}>
            <Ionicons name="alert-circle-outline" size={16} color={c.danger} />
            <Text style={[styles.socialNoticeText, { color: c.danger }]}>{socialNotice}</Text>
            <PressableScale
              onPress={() => setSocialNotice(null)}
              hitSlop={HitSlop}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Ionicons name="close" size={15} color={c.danger} />
            </PressableScale>
          </View>
        ) : null}

        <TwoFactorCard />

        <ConnectedAccounts />
          </View>

          <View style={isDesktop ? styles.column : undefined}>
        <Card style={styles.appearanceCard}>
          <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Appearance</Text>
          <Text style={[styles.cardHint, { color: c.textSecondary }]}>
            Day, night, or whatever your phone is doing.
          </Text>
          <SegmentedControl
            options={THEME_OPTIONS}
            value={mode}
            onChange={setMode}
            style={styles.themeControl}
          />
        </Card>

        {/*
          Reminders are the product's first promise, and until now there was no
          way to tell whether one was actually set: the app wrote a row, the OS
          may or may not have accepted it, and the difference only showed up as
          a nudge that never came. This reports the real OS queue rather than
          what the database believes, and fires one in five seconds so the
          whole delivery path can be checked without waiting for 9am.
        */}
        {Platform.OS !== 'web' ? (
          <Card style={styles.appearanceCard}>
            <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Reminders</Text>
            <Text style={[styles.cardHint, { color: c.textSecondary }]}>
              {notifPermission === 'granted'
                ? `${scheduledCount} scheduled with iOS right now.`
                : notifPermission === 'denied'
                  ? 'Turned off. Enable notifications for Blubanana in Settings.'
                  : 'Checking…'}
            </Text>
            <Button
              label={testState === 'sending' ? 'Sending…' : 'Send a test reminder'}
              variant="secondary"
              onPress={handleTestNotification}
              disabled={testState === 'sending'}
              style={styles.themeControl}
            />
            {testState === 'scheduled' ? (
              <Text style={[styles.cardHint, { color: c.success }]}>
                Sent. It should arrive in about five seconds, so put the app in the
                background to see the banner.
              </Text>
            ) : null}
            {testState === 'denied' ? (
              <Text style={[styles.cardHint, { color: c.warning }]}>
                iOS refused. Notifications are off for Blubanana in Settings.
              </Text>
            ) : null}
            {testState === 'failed' ? (
              <Text style={[styles.cardHint, { color: c.danger }]}>
                iOS would not accept it. If you are in Expo Go, try a development
                build: Expo Go limits what notifications it will schedule.
              </Text>
            ) : null}
          </Card>
        ) : null}

        <View style={styles.links}>
          <ListRow
            title="Billing details"
            subtitle="PAN, GSTIN and bank details for invoices"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="card" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={() => router.push('/(app)/profile/edit' as never)}
            index={0}
          />
          <ListRow
            title="Expenses"
            subtitle="What the work cost, for your Year report"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="receipt" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={() => router.push('/(app)/expenses' as never)}
            index={1}
          />
          <ListRow
            title="Advance tax"
            subtitle="What to set aside, and by which date"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="calculator" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={() => router.push('/(app)/tax' as never)}
            index={2}
          />
          <ListRow
            title="Plan and billing"
            subtitle="What you are on, and what it costs"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="card-outline" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={() => router.push('/(app)/plans' as never)}
            index={3}
          />
          <ListRow
            title="Rate card"
            subtitle="What you charge, built from your deals"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="id-card" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={() => router.push('/(app)/profile/card' as never)}
            index={4}
          />
          <ListRow
            title="Team"
            subtitle="Invite a manager, and choose what they see"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="people" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={() => router.push('/(app)/team' as never)}
            index={5}
          />
          {/* Above Import and Export because it is the row somebody is looking
              for when something has already gone wrong, and that is not the
              moment to be reading a list. */}
          <ListRow
            title="Get help"
            subtitle="Write in, and see what we said back"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="chatbubbles" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={() => router.push('/(app)/help' as never)}
            index={6}
          />
          {/* Reachable after onboarding too: §8.2 makes every onboarding step
              skippable, so the creator most likely to need this is exactly the
              one who skipped past the offer. */}
          <ListRow
            title="Import deals"
            subtitle="Bring across a spreadsheet or a photo"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="cloud-upload" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={() => router.push('/(app)/import' as never)}
            index={7}
          />
          <ListRow
            title="Export my data"
            subtitle="Every deal, payment and invoice, as a file"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="download" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={handleExport}
            index={8}
          />
          {/* Last, and directly under Export, which is deliberate: the one
              thing that makes this recoverable sits immediately above it. */}
          <ListRow
            title="Delete my account"
            subtitle="Removes your workspace, permanently"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.dangerLight }]}>
                <Ionicons name="trash" size={18} color={c.danger} />
              </View>
            }
            showChevron
            onPress={() => setDeleteOpen(true)}
            index={9}
          />
        </View>

        <Button
          label="Sign out"
          variant="secondary"
          fullWidth
          onPress={handleSignOut}
          style={styles.signOut}
        />
          </View>
        </View>
      </ScrollView>

      <DeleteAccountSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
        busy={deleting}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  socialNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
  },
  socialNoticeText: {
    flex: 1,
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerFlush: {
    paddingHorizontal: 0,
  },
  // Settings is a stack of unrelated cards, which is exactly the content that
  // reads as a long thin ribbon on a desktop window. Two columns, identity and
  // accounts on the left, preferences and billing on the right.
  columns: {
    flexDirection: 'row',
    gap: ColumnGap,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    gap: Spacing.sm,
  },
  stack: {
    gap: Spacing.sm,
  },
  appearanceCard: {
    gap: Spacing.xxs,
  },
  themeControl: {
    marginTop: Spacing.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  profileText: {
    flex: 1,
    gap: Spacing.xxs,
  },
  profileName: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  profileMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  cardTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  cardHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.xxs,
    lineHeight: 18,
  },
  link: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  links: {
    gap: Spacing.base,
    marginTop: Spacing.xs,
  },
  linkIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    marginTop: Spacing.lg,
  },
})
