import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Colors, Typography, FontFamily, Spacing } from '@/constants/design'

// Back button label is suppressed (empty string) because expo-router shows
// the previous screen title by default, which can be long on small screens.

export default function AppLayout() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light

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
      <Stack.Screen name="deal/new" options={{ title: 'Add deal' }} />
      {/* title for [id] is set dynamically inside the screen via Stack.Screen */}
      <Stack.Screen name="deal/[id]" options={{ title: 'Deal' }} />
      <Stack.Screen name="brand/new" options={{ title: 'Add brand' }} />
    </Stack>
  )
}
