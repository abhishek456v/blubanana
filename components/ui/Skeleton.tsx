import { useEffect } from 'react'
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Radius, Spacing } from '@/constants/design'
import { Duration, Ease } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'

export interface SkeletonProps {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Loading placeholder.
 *
 * Every list in this app previously showed a centred `ActivityIndicator` on a
 * blank page. A skeleton is better for the same reason it is everywhere else:
 * it holds the layout, so content lands where the eye is already looking
 * instead of the page reflowing on arrival.
 *
 * The pulse is an opacity breath rather than a swept gradient — DESIGN.md
 * rules out gradients, and a pulse costs one shared value instead of a
 * masked, translating overlay per row.
 */
export function Skeleton({ width = '100%', height = 14, radius = Radius.sm, style }: SkeletonProps) {
  const { c } = useTheme()
  const pulse = useSharedValue(0.55)

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: Duration.slower, easing: Ease.inOut }),
        withTiming(0.55, { duration: Duration.slower, easing: Ease.inOut })
      ),
      -1,
      false
    )
  }, [pulse])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[{ width, height, borderRadius: radius, backgroundColor: c.bgSurface }, animatedStyle, style]}
    />
  )
}

/**
 * Placeholder shaped like a `DealRow` — avatar, two text lines, trailing pill.
 * Matching the real row's geometry is the whole point; a generic grey bar
 * still causes a visible jump when the data lands.
 */
export function SkeletonRow() {
  const { c } = useTheme()
  return (
    <View style={[styles.row, { backgroundColor: c.bgSurface }]}>
      <Skeleton width={36} height={36} radius={Radius.sm} />
      <View style={styles.rowCenter}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="80%" height={11} />
      </View>
      <Skeleton width={62} height={20} radius={Radius.full} />
    </View>
  )
}

/** `count` deal-row placeholders with the same 10px gap the real list uses. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  rowCenter: {
    flex: 1,
    gap: 7,
  },
  list: {
    gap: Spacing.base,
  },
})
