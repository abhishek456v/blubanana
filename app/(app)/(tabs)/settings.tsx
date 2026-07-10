import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { BrandAvatar } from '@/components/BrandAvatar'
import { Colors, Spacing, Radius, Typography, FontFamily } from '@/constants/design'

export default function SettingsScreen() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const { session } = useAuth()

  const name = session?.user?.user_metadata?.name ?? 'Creator'
  const email = session?.user?.email ?? ''

  async function handleSignOut() {
    await supabase.auth.signOut()
    // Root layout detects cleared session and redirects to sign-in.
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: c.bgPage }]}
      edges={['bottom']}
    >
      <View style={[styles.profileCard, { backgroundColor: c.bgSurface }]}>
        <BrandAvatar name={name} size={48} />
        <View style={styles.profileText}>
          <Text style={[styles.profileName, { color: c.textPrimary }]}>{name}</Text>
          <Text style={[styles.profileEmail, { color: c.textMuted }]}>{email}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.signOutButton, { borderColor: c.borderStrong }]}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text style={[styles.signOutText, { color: c.textPrimary }]}>Sign out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
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
