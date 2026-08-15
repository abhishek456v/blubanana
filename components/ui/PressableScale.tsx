import type { ReactNode } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { PRESS_SCALE, Spring, Timing } from '@/constants/motion'
import { haptic, type HapticKind } from '@/lib/haptics'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Scale held during a press. DESIGN.md §5 sets the default at 0.97. */
  scaleTo?: number
  /**
   * Haptic fired on press-in, or `false` for none. Press-in rather than
   * press-out so the feedback lands with the finger, not after it lifts,
   * the same timing iOS uses.
   */
  haptic?: HapticKind | false
  /** Opacity applied on web hover. Native platforms never see this. */
  hoverOpacity?: number
}

/**
 * The press primitive every tappable surface in the app builds on.
 *
 * Replaces the bare `TouchableOpacity activeOpacity={0.7}` that was repeated
 * across every screen. An opacity fade tells you a tap registered; a scale
 * spring tells you the *thing itself* responded, which is most of the
 * difference between an app that feels native and one that feels like a
 * webview.
 *
 * Disabled presses skip both the animation and the haptic, so a dead control
 * never gives feedback that implies it did something.
 */
export function PressableScale({
  children,
  style,
  scaleTo = PRESS_SCALE,
  haptic: hapticKind = 'light',
  hoverOpacity = 0.85,
  disabled,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0)
  const hovered = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - hovered.value * (1 - hoverOpacity),
  }))

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        if (!disabled) {
          pressed.value = withSpring(1, Spring.snappy)
          if (hapticKind) haptic(hapticKind)
        }
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, Spring.snappy)
        onPressOut?.(e)
      }}
      onHoverIn={(e) => {
        if (!disabled) hovered.value = withTiming(1, Timing.fast)
        onHoverIn?.(e)
      }}
      onHoverOut={(e) => {
        hovered.value = withTiming(0, Timing.fast)
        onHoverOut?.(e)
      }}
    >
      {children}
    </AnimatedPressable>
  )
}
