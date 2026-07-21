import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Colors, Typography, FontFamily, Spacing } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'

// Back button label is suppressed (empty string) because expo-router shows
// the previous screen title by default, which can be long on small screens.

export default function AppLayout() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  const isWide = useIsWideScreen()

  // On wide screens, deal/new, deal/[id], brand/new, and profile/edit present
  // as a floating ModalSheet over the still-visible sidebar instead of a
  // full-page push, which would otherwise hide the sidebar (DESIGN.md 4).
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
          fontFamily: FontFamily.semiBold,
          fontSize: Typography.title.fontSize,
          color: c.textPrimary,
        },
        headerShadowVisible: false,
        headerTintColor: c.textPrimary,
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="deal/new" options={{ title: 'Add deal', ...modalScreenOptions }} />
      {/* title for [id] is set dynamically inside the screen via Stack.Screen */}
      <Stack.Screen name="deal/[id]" options={{ title: 'Deal', ...modalScreenOptions }} />
      <Stack.Screen name="brand/new" options={{ title: 'Add brand', ...modalScreenOptions }} />
      <Stack.Screen name="profile/edit" options={{ title: 'Edit profile', ...modalScreenOptions }} />
    </Stack>
  )
}
