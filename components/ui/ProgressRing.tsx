import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated'
import { FontFamily, Typography } from '@/constants/design'
import { Duration, Ease } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export interface ProgressRingProps {
  /** 0–1. Values above 1 are clamped so an over-performing post fills the ring. */
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
  /** Big text inside the ring — usually the engagement rate. */
  label?: string
  /** Small text under the label. */
  caption?: string
  /**
   * Text and track colours. Only needed when the ring sits on an inverted
   * ground (a `HeroCard`), where the page's text tokens would vanish into it.
   */
  labelColor?: string
  captionColor?: string
  trackColor?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Circular gauge for engagement rate on the Performance view.
 *
 * A ring rather than a bar because engagement is a proportion the creator
 * reads against a benchmark ("is this good?"), and a closed shape communicates
 * "out of a whole" without needing an axis.
 */
export function ProgressRing({
  progress,
  size = 92,
  strokeWidth = 8,
  color,
  label,
  caption,
  labelColor,
  captionColor,
  trackColor,
  style,
}: ProgressRingProps) {
  const { c } = useTheme()
  const stroke = color ?? c.accent

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(progress, 0), 1)

  const animated = useDerivedValue(
    () => withTiming(clamped, { duration: Duration.slower, easing: Ease.out }),
    [clamped]
  )

  // Drawing the arc by retracting the dash offset means the ring sweeps
  // clockwise from the top rather than fading in at full length.
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }))

  return (
    <View style={[{ width: size, height: size }, styles.container, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? c.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Rotates the start of the arc from 3 o'clock to 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {label ? (
        <View style={styles.center}>
          <Text style={[styles.label, { color: labelColor ?? c.textPrimary }]} numberOfLines={1}>
            {label}
          </Text>
          {caption ? (
            <Text
              style={[styles.caption, { color: captionColor ?? c.textMuted }]}
              numberOfLines={1}
            >
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  label: {
    ...Typography.title,
    fontFamily: FontFamily.display,
  },
  caption: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
})
