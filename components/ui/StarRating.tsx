import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated'
import { Spacing } from '@/constants/design'
import { Spring } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface StarRatingProps {
  /** 0 means unrated. */
  value: number
  onChange?: (value: number) => void
  size?: number
  max?: number
  /** Display-only: no press targets, no haptics. */
  readonly?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Star rating for the post-deal survey and the brand reputation display.
 *
 * Deal detail rendered this as five numbered square buttons: accurate, but
 * it read as a form field rather than a judgement, which is the wrong feel
 * for the question "would you work with them again?".
 *
 * Filled stars spring in when selected, so tapping the fourth star visibly
 * fills one through four instead of silently repainting them.
 */
export function StarRating({
  value,
  onChange,
  size = 28,
  max = 5,
  readonly = false,
  style,
}: StarRatingProps) {
  const { c } = useTheme()

  return (
    <View
      style={[styles.row, style]}
      accessibilityRole={readonly ? 'text' : 'adjustable'}
      accessibilityLabel={`${value} out of ${max}`}
    >
      {Array.from({ length: max }, (_, index) => (
        <Star
          key={index}
          index={index}
          filled={index < value}
          size={size}
          readonly={readonly || !onChange}
          color={c.accent}
          emptyColor={c.borderStrong}
          onPress={() => onChange?.(index + 1)}
        />
      ))}
    </View>
  )
}

interface StarProps {
  index: number
  filled: boolean
  size: number
  readonly: boolean
  color: string
  emptyColor: string
  onPress: () => void
}

function Star({ filled, size, readonly, color, emptyColor, onPress }: StarProps) {
  // Overshoots to ~1.12 on fill and settles: the pop that makes the rating
  // feel like it registered rather than merely re-rendered.
  const scale = useDerivedValue(() => withSpring(filled ? 1 : 0.92, Spring.bouncy), [filled])
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const icon = (
    <Animated.View style={animatedStyle}>
      <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={filled ? color : emptyColor} />
    </Animated.View>
  )

  if (readonly) return icon

  return (
    <PressableScale onPress={onPress} haptic="selection" scaleTo={0.85} hitSlop={6}>
      {icon}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
})
