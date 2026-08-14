import type { ReactNode } from 'react'
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useIsFocused } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Typography, FontFamily } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'

interface ModalSheetProps {
  title: string
  headerRight?: ReactNode
  children: ReactNode
}

// Wraps deal/new, brand/new, profile/edit, and deal/[id]. On wide screens
// these present as a floating card over a dimmed backdrop instead of a
// full-page native-stack push, so the sidebar (DESIGN.md 4) stays visible
// behind them — the caller's Stack.Screen sets headerShown: false and
// presentation: 'transparentModal' for the same breakpoint (see
// app/(app)/_layout.tsx), so this is the only chrome the screen gets.
// On mobile widths this is a passthrough — the screen keeps its native
// Stack header and full-page layout, unchanged.
export function ModalSheet({ title, headerRight, children }: ModalSheetProps) {
  const isWide = useIsWideScreen()
  const router = useRouter()
  const { c } = useTheme()
  // The Stack keeps this screen mounted after router.back() navigates away
  // from it (for back-gesture support), so the backdrop must not render
  // once unfocused — an absolute, full-viewport Pressable left behind would
  // silently swallow every click on the screen underneath.
  const isFocused = useIsFocused()

  if (!isWide) return <>{children}</>
  if (!isFocused) return null

  return (
    <Pressable style={styles.backdrop} onPress={() => router.back()}>
      <Pressable
        style={[styles.card, { backgroundColor: c.bgSurfaceRaised, borderColor: c.border }]}
        // Stops the tap from bubbling to the backdrop's dismiss handler —
        // react-native-web's Pressable uses real DOM click bubbling.
        onPress={(e) => e.stopPropagation()}
      >
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerRight}>
            {headerRight}
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={c.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.body}>{children}</View>
      </Pressable>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    zIndex: 100,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    ...Typography.title,
    fontFamily: FontFamily.semiBold,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  body: {
    flexShrink: 1,
  },
})
