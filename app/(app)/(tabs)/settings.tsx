import { useCallback, useState } from 'react'
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { supabase } from '@/lib/supabase'
import { buildExport } from '@/lib/exportData'
import { disablePublicProfile, enablePublicProfile, getProfile } from '@/lib/profile'
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
import {
  ColumnGap,
  DesktopContentMaxWidth,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import {
  Button,
  Card,
  HeaderUtilities,
  ListRow,
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

// Native has no window.location. The public profile card only resolves to a
// real URL on the web build, so native shows the path with a note instead of
// a broken link.
function publicProfileUrl(slug: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/creator/${slug}`
  }
  return `/creator/${slug}`
}

export default function YouScreen() {
  const { c } = useTheme()
  const router = useRouter()
  const { session } = useAuth()
  const { isDesktop } = useBreakpoint()
  const { mode, setMode } = useThemeMode()
  const toast = useToast()
  const confirm = useConfirm()

  const [profile, setProfile] = useState<Creator | null>(null)
  const [togglingPublic, setTogglingPublic] = useState(false)
  const [exporting, setExporting] = useState(false)
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
  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      const bundle = await buildExport()
      const json = JSON.stringify(bundle, null, 2)
      const name = `creatordesk-export-${new Date().toISOString().slice(0, 10)}.json`

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

  async function handleTogglePublicProfile(next: boolean) {
    if (togglingPublic) return
    setTogglingPublic(true)
    try {
      setProfile(next ? await enablePublicProfile() : await disablePublicProfile())
      toast(next ? 'Your profile card is live' : 'Profile card turned off', {
        tone: next ? 'success' : 'neutral',
      })
    } catch {
      toast('Could not update your profile card', { tone: 'error' })
    } finally {
      setTogglingPublic(false)
    }
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
                  ? 'Turned off. Enable notifications for CreatorDesk in Settings.'
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
                iOS refused. Notifications are off for CreatorDesk in Settings.
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

        <Card>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Profile card</Text>
              <Text style={[styles.cardHint, { color: c.textSecondary }]}>
                A public page you can send a brand mid-negotiation. Shows your niche, reach and deals
                completed. Never shows payment or contact details.
              </Text>
            </View>
            {togglingPublic ? (
              <ActivityIndicator color={c.textMuted} />
            ) : (
              <Switch
                value={profile?.public_profile_enabled ?? false}
                onValueChange={handleTogglePublicProfile}
                trackColor={{ false: c.border, true: c.accentLight }}
                thumbColor={profile?.public_profile_enabled ? c.accent : undefined}
              />
            )}
          </View>

          {profile?.public_profile_enabled && profile.public_share_slug ? (
            <View style={[styles.linkBox, { backgroundColor: c.bgPage }]}>
              <Text style={[styles.link, { color: c.accentText }]} selectable numberOfLines={1}>
                {publicProfileUrl(profile.public_share_slug)}
              </Text>
            </View>
          ) : null}
        </Card>

        <View style={styles.links}>
          <ListRow
            title="Billing details"
            subtitle="PAN, GSTIN and bank details used on your invoices"
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
            title="Export my data"
            subtitle="Every deal, brand, payment, invoice and expense as a file"
            leading={
              <View style={[styles.linkIcon, { backgroundColor: c.accentLight }]}>
                <Ionicons name="download" size={18} color={c.accent} />
              </View>
            }
            showChevron
            onPress={handleExport}
            index={1}
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  toggleText: {
    flex: 1,
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
  linkBox: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
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
