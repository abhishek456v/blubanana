import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { claimPendingInvites } from '@/lib/team'
import { Typography, FontFamily, Spacing } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'

// Back button label is suppressed (empty string) because expo-router shows
// the previous screen title by default, which can be long on small screens.

/**
 * Anchor the stack to the tab navigator.
 *
 * Without this, opening any of the routes below directly (a deep link, a
 * notification tap, or just a browser refresh on /invoices) starts the
 * history at that screen. There is nothing beneath it, so react-navigation
 * renders no back button, `router.back()` is a no-op, and on wide screens the
 * modal floats over an empty page with the app nowhere to be seen.
 *
 * Declaring the anchor makes expo-router synthesise `(tabs)` underneath any
 * such entry, which restores the back affordance and puts the app back behind
 * the sheet. One line, and it fixes every route in this stack rather than each
 * screen patching itself.
 */
export const unstable_settings = {
  initialRouteName: '(tabs)',
}

export default function AppLayout() {
  const { c } = useTheme()
  const isWide = useIsWideScreen()

  // Turn any invite addressed to this account into a membership.
  //
  // Here rather than in the sign-up flow because a creator can invite someone
  // who already has an account, and that person would never pass through
  // sign-up again to collect it. This layout mounts once per session and only
  // for a signed-in user, which is exactly the moment the check is worth.
  //
  // Failure is swallowed on purpose: an invite that does not resolve must not
  // stop someone reaching their own workspace.
  useEffect(() => {
    claimPendingInvites().catch(() => {})
  }, [])

  // On wide screens, deal/new, deal/[id], brand/new, and profile/edit present
  // as a floating ModalSheet over the still-visible sidebar instead of a
  // full-page push, which would otherwise hide the sidebar.
  // ModalSheet supplies its own header in that case, so the native one is
  // turned off here; on mobile widths this object is empty and behavior is
  // unchanged from a plain push.
  const modalScreenOptions = isWide
    ? { headerShown: false, presentation: 'transparentModal' as const }
    : {}

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bgPage },
        headerTitleStyle: {
          fontFamily: FontFamily.display,
          fontSize: Typography.title.fontSize,
          color: c.textPrimary,
        },
        headerShadowVisible: false,
        headerTintColor: c.textPrimary,
        headerBackTitle: '',
      }}
    >
      {/* The title is never displayed (this screen hides its header), but it
          is what every pushed screen shows on its back button. Without it the
          back control reads "(tabs)", the raw route-group name. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
      <Stack.Screen name="deal/new" options={{ title: 'Add deal', ...modalScreenOptions }} />
      {/* title for [id] screens is set dynamically inside the screen via Stack.Screen */}
      {/* Deliberately not a modal on wide screens, unlike the forms around it:
          deal detail is the app's largest working surface and lays out in two
          columns there, which a floating sheet cannot give it. */}
      <Stack.Screen name="deal/[id]" options={{ title: 'Deal' }} />
      <Stack.Screen name="brand/new" options={{ title: 'Add brand', ...modalScreenOptions }} />
      <Stack.Screen name="brand/[id]" options={{ title: 'Brand', ...modalScreenOptions }} />
      <Stack.Screen name="profile/edit" options={{ title: 'Edit profile', ...modalScreenOptions }} />
      <Stack.Screen name="profile/card" options={{ title: 'Rate card', ...modalScreenOptions }} />
      <Stack.Screen name="invoice/new" options={{ title: 'Create invoice', ...modalScreenOptions }} />
      <Stack.Screen name="invoice/[id]" options={{ title: 'Invoice', ...modalScreenOptions }} />
      <Stack.Screen name="invoices" options={{ title: 'Invoices', ...modalScreenOptions }} />
      {/* Not a modal on wide screens: it's a full working surface with its own
          header and two tabs, not a focused form to fill in and dismiss. */}
      <Stack.Screen name="reminders" options={{ title: 'Reminders', headerShown: false }} />
      {/* Full-screen, chromeless: it draws its own progress dots and Skip. */}
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="import" options={{ title: 'Import deals', ...modalScreenOptions }} />
      <Stack.Screen name="annual-report" options={{ title: 'Annual report', ...modalScreenOptions }} />
      <Stack.Screen name="team" options={{ title: 'Team', ...modalScreenOptions }} />
    </Stack>
  )
}
