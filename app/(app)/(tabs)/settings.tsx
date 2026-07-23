import { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/lib/profile'
import { useAuth } from '@/hooks/useAuth'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { BrandAvatar } from '@/components/BrandAvatar'
import { Colors, Spacing, Radius, Typography, FontFamily, ContentMaxWidth } from '@/constants/design'
import type { Creator } from '@/types'

export default function SettingsScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const router = useRouter()
  const { session } = useAuth()

  const isWide = useIsWideScreen()

  const [profile, setProfile] = useState<Creator | null>(null)
  const email = session?.user?.email ?? ''
  // Falls back to the auth session's name while the profiles row is loading,
  // so the header isn't briefly blank on first render.
  const name = profile?.name || session?.user?.user_metadata?.name || 'Creator'

  const loadProfile = useCallback(async () => {
    try {
      const data = await getProfile()
      setProfile(data)
    } catch {
      // Non-fatal: falls back to session metadata for the name.
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadProfile()
    }, [loadProfile])
  )

  async function handleSignOut() {
    await supabase.auth.signOut()
    // Root layout detects cleared session and redirects to sign-in.
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: c.bgPage }]}
      edges={['bottom']}
    >
      <View style={[styles.inner, isWide && styles.innerWide]}>
      <TouchableOpacity
        style={[styles.profileCard, { backgroundColor: c.bgSurface }]}
        onPress={() => router.push('/(app)/profile/edit' as never)}
        activeOpacity={0.7}
      >
        <BrandAvatar name={name} size={48} />
        <View style={styles.profileText}>
          <Text style={[styles.profileName, { color: c.textPrimary }]}>{name}</Text>
          <Text style={[styles.profileEmail, { color: c.textMuted }]}>{email}</Text>
          {profile?.phone || profile?.follower_count ? (
            <Text style={[styles.profileMeta, { color: c.textMuted }]} numberOfLines={1}>
              {[
                profile.phone,
                profile.follower_count != null
                  ? `${profile.follower_count.toLocaleString('en-IN')} followers`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.editLink, { color: c.accent }]}>Edit</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.signOutButton, { borderColor: c.borderStrong }]}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text style={[styles.signOutText, { color: c.danger }]}>Sign out</Text>
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  inner: {
    flex: 1,
  },
  innerWide: {
    maxWidth: ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  profileEmail: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  profileMeta: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
  editLink: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  signOutButton: {
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.medium,
  },
})
