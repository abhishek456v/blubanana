// Must be the first import in the entry tree: Gesture Handler patches the
// native touch pipeline at module load, and anything that renders before it
// runs will not receive gestures on Android.
import 'react-native-gesture-handler'

import { useEffect, useState } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import * as Linking from 'expo-linking'
import { useFonts } from 'expo-font'
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit'
import { Doto_500Medium, Doto_700Bold } from '@expo-google-fonts/doto'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native'
import { FeedbackProvider } from '@/components/ui'
import { ThemeProvider, useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { setForegroundHandler, ensureAndroidChannelAsync, scheduleAsync } from '@/lib/notifications'
import { rebuildLocalNotifications } from '@/lib/reminderChains'
import { registerPushToken } from '@/lib/push'

SplashScreen.preventAutoHideAsync()
setForegroundHandler()

// A password-reset email link carries its session as a URL fragment
// (#access_token=...&type=recovery), Supabase's implicit auth flow. Web
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
  // "session exists → go to the app" redirect below. It's not a real
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

  // Two families, two jobs. Outfit sets every word; Doto sets every figure.
  // Both have to be resolved before the first frame, because a dot-matrix
  // figure falling back to the system face is not a subtle degradation: the
  // amount on the hero card changes shape entirely.
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Doto_500Medium,
    Doto_700Bold,
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

    // The shareable creator profile card (Phase 3) is the one route meant to
    // be opened by someone with no account at all, say a brand clicking a link,
    // so it's excluded from the sign-in redirect entirely.
    if (segments[0] === 'creator') return

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
  // password#...). Web doesn't need this: the Supabase client parses
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

  // Notifications: server push if this device can receive it, local scheduling
  // if it cannot.
  //
  // The server (supabase/functions/send-due-reminders) is the real mechanism:
  // it wakes on a cron and pushes, so a deadline arrives whether or not the app
  // has been opened this week. On-device scheduling could never do that, which
  // is why a creator who ignored the app for a few days silently got nothing.
  //
  // But push needs a development build and a granted permission. Expo Go, a
  // simulator, the web build and a declined prompt all legitimately have no
  // token, and on those the local schedule is still better than no reminders
  // at all. So exactly one of the two runs: registering a token means the
  // server owns this device, and scheduling locally as well would deliver
  // every reminder twice.
  useEffect(() => {
    if (!session || loading) return
    let active = true

    registerPushToken()
      .then((token) => {
        if (!active || token) return
        if (Platform.OS === 'web') return

        return rebuildLocalNotifications(async (reminder) =>
          scheduleAsync(
            {
              title: reminder.title,
              body: reminder.body ?? '',
              data: {
                type: reminder.type,
                dealId: reminder.deal_id ?? '',
                stage: reminder.stage ?? '',
              },
            },
            new Date(reminder.scheduled_for)
          )
        )
      })
      .catch(() => {
        // Best effort. A failure here leaves whatever was previously scheduled
        // in place; it never blocks the app from opening.
      })

    return () => {
      active = false
    }
  }, [session, loading])

  // Workflow/payment reminder notifications are never actionable in-place:
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
    <GestureHandlerRootView style={styles.root}>
      {/* Every useSafeAreaInsets() in the app reads from here. Without it the
          hook reports zeros rather than throwing, so the tab bar sat in the
          home-indicator strip and swallowed its own taps, with nothing in the
          logs to show for it. */}
      <SafeAreaProvider>
        {/* FeedbackProvider hosts the toast and confirmation surfaces. It sits
            above the router so a toast raised on any screen survives the
            navigation that usually follows it (save → toast → go back). */}
        <ThemeProvider>
          <NavigationTheme>
            <FeedbackProvider>
              <StatusBar style="auto" />
              <Slot />
            </FeedbackProvider>
          </NavigationTheme>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

/**
 * Hands the app's palette to React Navigation.
 *
 * Without this the library falls back to its own `DefaultTheme`, whose
 * background is `rgb(242,242,242)`. Screens hide it because each one paints
 * its own ground, so it only shows through where the navigator draws a
 * container of its own: most visibly as a light grey slab behind the tab dock
 * on the dark theme, and briefly behind screen transitions.
 *
 * Nested inside our `ThemeProvider` because it has to read the resolved
 * palette, which means it cannot live at the same level as the provider that
 * supplies it.
 */
function NavigationTheme({ children }: { children: React.ReactNode }) {
  const { c, isDark } = useTheme()
  const base = isDark ? DarkTheme : DefaultTheme

  return (
    <NavigationThemeProvider
      value={{
        ...base,
        dark: isDark,
        colors: {
          ...base.colors,
          primary: c.accent,
          background: c.bgPage,
          card: c.bgPage,
          text: c.textPrimary,
          border: c.border,
          notification: c.danger,
        },
      }}
    >
      {children}
    </NavigationThemeProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
