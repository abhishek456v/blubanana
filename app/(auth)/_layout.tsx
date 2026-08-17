import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { ThemeProvider as NavigationThemeProvider, useTheme as useNavTheme } from '@react-navigation/native'
import { AuraBackground } from '@/components/ui'
import { useTheme } from '@/hooks/useTheme'

/**
 * The wash sits here rather than on each auth screen so it stays put across
 * sign-in → sign-up → forgot-password. Painted per screen it would be torn
 * down and rebuilt on every navigation, and the light would visibly jump.
 *
 * The scene background has to be transparent for any of it to show. The root
 * layout hands React Navigation the app's palette — without that, the library
 * falls back to its own theme and paints a light slab behind the tab dock —
 * and the navigator uses `colors.background` to fill each scene container,
 * which sits above this View's children and hides the wash completely.
 * `contentStyle` does not override it, so the colour itself is overridden for
 * this group only.
 */
export default function AuthLayout() {
  const { c } = useTheme()

  return (
    <View style={[styles.root, { backgroundColor: c.bgPage }]}>
      <AuraBackground />
      <TransparentScenes>
        <Stack screenOptions={{ headerShown: false }} />
      </TransparentScenes>
    </View>
  )
}

function TransparentScenes({ children }: { children: React.ReactNode }) {
  const base = useNavTheme()
  return (
    <NavigationThemeProvider
      value={{ ...base, colors: { ...base.colors, background: 'transparent' } }}
    >
      {children}
    </NavigationThemeProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
