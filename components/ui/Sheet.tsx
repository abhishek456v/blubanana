import { useEffect, useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Elevation, FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { Spring, Timing } from '@/constants/motion'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { haptic } from '@/lib/haptics'

export interface SheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Hides the grabber and disables drag-to-dismiss. For destructive confirms. */
  dismissable?: boolean
  style?: StyleProp<ViewStyle>
}

/** Drag distance past which release dismisses instead of springing back. */
const DISMISS_DISTANCE = 110
/** A fast downward flick dismisses regardless of how far it travelled. */
const DISMISS_VELOCITY = 800

/**
 * Modal surface for in-screen flows: the date picker, confirmation prompts,
 * action menus.
 *
 * Adapts rather than being two components: on phones it is a bottom sheet
 * with a grabber and drag-to-dismiss; at the `wide` breakpoint it becomes a
 * centred card, because a sheet climbing out of the bottom edge of a desktop
 * browser reads as a phone emulator.
 *
 * Built directly on Reanimated and Gesture Handler rather than pulling in a
 * sheet library: this app ships to web as a first-class target, and the
 * mainstream RN sheet libraries treat web as a fallback. ~150 lines buys
 * identical physics on all three platforms.
 */
export function Sheet({ visible, onClose, title, children, dismissable = true, style }: SheetProps) {
  const { c, isDark } = useTheme()
  const isWide = useIsWideScreen()
  const insets = useSafeAreaInsets()
  const elevation = isDark ? Elevation.dark : Elevation.light

  // The sheet has to stay mounted through its exit animation, so visibility
  // (the prop) and presence in the tree (this state) are tracked separately.
  const [mounted, setMounted] = useState(visible)

  const progress = useSharedValue(0)
  const dragY = useSharedValue(0)
  const height = useSharedValue(600)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      dragY.value = 0
      progress.value = withSpring(1, Spring.gentle)
    } else {
      dragY.value = withTiming(0, Timing.exit)
      progress.value = withTiming(0, Timing.exit, (finished) => {
        if (finished) runOnJS(setMounted)(false)
      })
    }
  }, [visible, progress, dragY])

  const pan = Gesture.Pan()
    .enabled(dismissable && !isWide)
    // Downward drags belong to the sheet; anything else (a scroll inside the
    // content, a horizontal swipe) is left alone.
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY)
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(haptic)('medium')
        runOnJS(onClose)()
      } else {
        dragY.value = withSpring(0, Spring.gentle)
      }
    })

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }))

  const sheetStyle = useAnimatedStyle(() => {
    if (isWide) {
      return {
        opacity: progress.value,
        transform: [{ scale: 0.96 + progress.value * 0.04 }],
      }
    }
    return {
      transform: [{ translateY: (1 - progress.value) * height.value + dragY.value }],
    }
  })

  if (!mounted) return null

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Gesture Handler needs its own root inside a Modal on Android: the
          app-level root does not extend into the modal's separate window. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          />
        </Animated.View>

        <View style={[styles.positioner, isWide ? styles.positionerWide : styles.positionerMobile]}>
          <GestureDetector gesture={pan}>
            <Animated.View
              onLayout={(e) => {
                height.value = e.nativeEvent.layout.height
              }}
              style={[
                styles.sheet,
                isWide ? styles.sheetWide : styles.sheetMobile,
                {
                  backgroundColor: c.bgSurfaceRaised,
                  paddingBottom: isWide ? Spacing.lg : Math.max(insets.bottom, Spacing.lg),
                },
                elevation.md,
                sheetStyle,
                style,
              ]}
            >
              {!isWide && dismissable ? (
                <View style={[styles.grabber, { backgroundColor: c.borderStrong }]} />
              ) : null}

              {title ? (
                <View style={styles.header}>
                  <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>
                    {title}
                  </Text>
                  {dismissable ? (
                    <Pressable onPress={onClose} hitSlop={HitSlop} accessibilityLabel="Close">
                      <Ionicons name="close" size={20} color={c.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {children}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: 'rgba(12,9,6,0.55)',
  },
  positioner: {
    flex: 1,
  },
  positionerMobile: {
    justifyContent: 'flex-end',
  },
  positionerWide: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  sheetMobile: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '90%',
  },
  sheetWide: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    borderRadius: Radius.lg,
    paddingTop: Spacing.lg,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.title,
    fontFamily: FontFamily.display,
    flexShrink: 1,
  },
})
