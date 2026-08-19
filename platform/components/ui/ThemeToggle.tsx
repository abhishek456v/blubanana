import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Radius, Spacing } from '@/constants/design'
import { Spring, Timing } from '@/constants/motion'
import { useTheme, useThemeMode } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface ThemeToggleProps {
  size?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Day / night switch.
 *
 * A single tap flips to the opposite of what is currently on screen, rather
 * than cycling light → dark → system. Cycling through three states means one
 * tap in three appears to do nothing (system, when it already matches), which
 * reads as a broken button.
 *
 * The icons cross-fade and rotate rather than swapping, so the control looks
 * like it is turning rather than being replaced.
 */
export function ThemeToggle({ size = 40, style }: ThemeToggleProps) {
  const { c } = useTheme()
  const { isDark, cycleMode } = useThemeMode()

  const progress = useDerivedValue(
    () => withTiming(isDark ? 1 : 0, Timing.base),
    [isDark]
  )
  const spin = useDerivedValue(() => withSpring(isDark ? 1 : 0, Spring.gentle), [isDark])

  const sunStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ rotate: `${spin.value * 90}deg` }, { scale: 1 - progress.value * 0.4 }],
  }))

  const moonStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ rotate: `${(spin.value - 1) * 90}deg` }, { scale: 0.6 + progress.value * 0.4 }],
  }))

  return (
    <PressableScale
      onPress={cycleMode}
      haptic="medium"
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? 'Switch to day mode' : 'Switch to night mode'}
      style={[
        styles.button,
        { width: size, height: size, backgroundColor: c.bgSurface },
        style,
      ]}
    >
      <View style={styles.iconStack}>
        <Animated.View style={[styles.icon, sunStyle]}>
          <Ionicons name="sunny" size={size * 0.48} color={c.accent} />
        </Animated.View>
        <Animated.View style={[styles.icon, moonStyle]}>
          <Ionicons name="moon" size={size * 0.44} color={c.accent} />
        </Animated.View>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
