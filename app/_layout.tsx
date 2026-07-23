import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import * as Linking from 'expo-linking'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter'
import { Syne_600SemiBold, Syne_700Bold } from '@expo-google-fonts/syne'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { setForegroundHandler, ensureAndroidChannelAsync } from '@/lib/notifications'

SplashScreen.preventAutoHideAsync()
setForegroundHandler()

// A password-reset email link carries its session as a URL fragment
// (#access_token=...&type=recovery) — Supabase's implicit auth flow. Web
// picks this up on its own (lib/supabase.ts detectSessionInUrl: true);
// native has no window.location for the client to read, so this parses the
// deep link by hand and hands the tokens to setSession.
function parseRecoveryTokens(url: string): { access_token: string; refresh_token: string } | null {
  const hashIndex = url.indexOf('#')
  if (hashIndex === -1) return null
  const params = new URLSearchParams(url.slice(hashIndex + 1))
  if (params.get('type') !== 'recovery') return null
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  return access_token && refresh_token ? { access_token, refresh_token } : null
}

export default function RootLayout() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  // A password-recovery session must never fall through to the normal
  // "session exists → go to the app" redirect below — it's not a real
  // sign-in, just enough of a session for updateUser({ password }) to work.
  // Kept as local state here (not in useAuth) since only this one redirect
  // decision needs it, and a plain setState in the component that owns the
  // decision is simpler than sharing mutable flags across independent
  // useAuth() call sites.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Syne_600SemiBold,
    Syne_700Bold,
  })

  // Hide splash once both fonts and auth state are ready.
  useEffect(() => {
    if (fontsLoaded && !loading) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, loading])

  // Redirect based on auth state whenever session or route group changes.
  useEffect(() => {
    if (loading || !fontsLoaded) return

    const inAuthGroup = segments[0] === '(auth)'

    if (isPasswordRecovery) {
      if (segments[1] !== 'reset-password') router.replace('/(auth)/reset-password' as never)
      return
    }

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (session && inAuthGroup) {
      router.replace('/(app)/(tabs)/' as never)
    }
  }, [session, loading, fontsLoaded, segments, isPasswordRecovery])

  // Native-only: catch password-recovery deep links (creatordesk://reset-
  // password#...). Web doesn't need this — the Supabase client parses
  // window.location itself and fires PASSWORD_RECOVERY, caught above.
  useEffect(() => {
    if (Platform.OS === 'web') return

    async function handleUrl(url: string) {
      const tokens = parseRecoveryTokens(url)
      if (!tokens) return
      const { error } = await supabase.auth.setSession(tokens)
      if (!error) setIsPasswordRecovery(true)
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url)
    })
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => subscription.remove()
  }, [])

  // Workflow/payment reminder notifications are never actionable in-place —
  // tapping one just deep-links into the relevant deal, where the response
  // buttons/WhatsApp send button live (PRODUCT.md 2.3, 2.4).
  // expo-notifications' response APIs aren't implemented on web at all
  // (calling them throws), so this whole concern is native-only.
  useEffect(() => {
    if (Platform.OS === 'web') return

    ensureAndroidChannelAsync()

    function handleResponse(response: Notifications.NotificationResponse) {
      const dealId = response.notification.request.content.data?.dealId
      if (typeof dealId === 'string') {
        router.push(`/(app)/deal/${dealId}` as never)
      }
    }

    // Cold start: app was killed and opened via a notification tap.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response)
    })

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse)
    return () => subscription.remove()
  }, [router])

  // Render nothing until fonts and auth are ready to prevent flash.
  if (!fontsLoaded || loading) return null

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  )
}
