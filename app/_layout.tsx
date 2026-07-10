import { useEffect } from 'react'
import { Platform } from 'react-native'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter'
import { useAuth } from '@/hooks/useAuth'
import { setForegroundHandler, ensureAndroidChannelAsync } from '@/lib/notifications'

SplashScreen.preventAutoHideAsync()
setForegroundHandler()

export default function RootLayout() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
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

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (session && inAuthGroup) {
      router.replace('/(app)/(tabs)/' as never)
    }
  }, [session, loading, fontsLoaded, segments])

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
