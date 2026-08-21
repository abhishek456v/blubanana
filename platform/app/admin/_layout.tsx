import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { usePlatformRole } from '@/hooks/usePlatformRole'
import { FontFamily, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'

/**
 * The admin area's door.
 *
 * It is not hidden. Every route in this app is already readable in the
 * JavaScript the site ships to every visitor, so the address is public whether
 * anyone likes it or not, and a design that leans on a secret URL fails the
 * first time somebody opens the bundle. This does not try.
 *
 * What it does instead is answer the same to everybody who is not an admin:
 * nothing here. A signed-in creator who types the address sees the same screen
 * as a stranger, and neither learns that an admin area exists.
 *
 * This guard is for rendering, not for safety. Somebody who patched it in
 * their own browser would reach a shell with no data in it, because every
 * figure on every screen behind this comes from the `admin` edge function,
 * which asks the database the same question again on the server. There is no
 * key in this app that can read another creator's business.
 */
export default function AdminLayout() {
  const router = useRouter()
  const { c } = useTheme()
  const { session, loading: authLoading } = useAuth()
  const { role, loading: roleLoading } = usePlatformRole()

  const loading = authLoading || roleLoading

  useEffect(() => {
    if (loading) return
    // Not signed in at all: the root layout already sends these to sign-in,
    // so this only catches the gap while a session is being torn down.
    if (!session) router.replace('/(auth)/sign-in')
  }, [loading, session, router])

  if (loading) {
    return (
      <View style={[styles.centre, { backgroundColor: c.bgPage }]}>
        <ActivityIndicator color={c.textMuted} />
      </View>
    )
  }

  if (!role) {
    // Deliberately says nothing about what is here or who may reach it. The
    // wording is what a mistyped URL would produce, because for almost
    // everybody who reaches it, that is what happened.
    return (
      <View style={[styles.centre, { backgroundColor: c.bgPage }]}>
        <Text style={[styles.title, { color: c.textPrimary }]}>Nothing here</Text>
        <Text style={[styles.body, { color: c.textSecondary }]}>
          This page does not exist. Check the address, or go back to your dashboard.
        </Text>
      </View>
    )
  }

  return <Stack screenOptions={{ headerShown: false }} />
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  body: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 22,
  },
})
