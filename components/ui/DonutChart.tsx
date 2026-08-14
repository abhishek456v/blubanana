import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { FontFamily, Radius, Typography } from '@/constants/design'
import { Duration, Ease } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export interface DonutSegment {
  label: string
  value: number
  color: string
}

export interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
  /** Big text in the hole — usually the total. */
  centerLabel?: string
  /** Small text under it. */
  centerCaption?: string
  /** Empty-ring colour. Defaults to the page border; override on a hero card. */
  trackColor?: string
  /** Colour for the centre text. Override on a hero card. */
  textColor?: string
  mutedTextColor?: string
  /** Draws a labelled legend beside the ring. */
  showLegend?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Proportional ring — where the money sits, split paid / pending / overdue.
 *
 * Distinct from `ProgressRing`, which shows one value against a whole. This
 * shows how a whole divides, which is the question Money and Home actually ask
 * ("of what I'm owed, how much is already late?").
 *
 * Segments are drawn as dash-array arcs on concentric circles rather than
 * wedge paths, so each one animates by retracting its own dash offset and the
 * ring assembles clockwise on mount.
 */
export function DonutChart({
  segments,
  size = 116,
  strokeWidth = 14,
  centerLabel,
  centerCaption,
  trackColor,
  textColor,
  mutedTextColor,
  showLegend = false,
  style,
}: DonutChartProps) {
  const { c } = useTheme()

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0)

  // Each arc needs to know where the previous ones ended, so offsets are
  // accumulated here rather than inside the segment component.
  let cursor = 0
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((segment, index) => {
      const fraction = total > 0 ? segment.value / total : 0
      const start = cursor
      cursor += fraction
      return { ...segment, fraction, start, index }
    })

  const ring = (
    <View style={[{ width: size, height: size }, styles.ringBox]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? c.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {arcs.map((arc) => (
          <Arc
            key={`${arc.label}-${arc.index}`}
            size={size}
            radius={radius}
            strokeWidth={strokeWidth}
            circumference={circumference}
            fraction={arc.fraction}
            start={arc.start}
            color={arc.color}
            index={arc.index}
          />
        ))}
      </Svg>

      {centerLabel ? (
        <View style={styles.center} pointerEvents="none">
          <Text
            style={[styles.centerLabel, { color: textColor ?? c.textPrimary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {centerLabel}
          </Text>
          {centerCaption ? (
            <Text
              style={[styles.centerCaption, { color: mutedTextColor ?? c.textMuted }]}
              numberOfLines={1}
            >
              {centerCaption}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )

  if (!showLegend) return <View style={style}>{ring}</View>

  return (
    <View style={[styles.withLegend, style]}>
      {ring}
      <View style={styles.legend}>
        {segments.map((segment) => (
          <View key={segment.label} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: segment.color }]} />
            <Text
              style={[styles.legendLabel, { color: mutedTextColor ?? c.textSecondary }]}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

interface ArcProps {
  size: number
  radius: number
  strokeWidth: number
  circumference: number
  fraction: number
  start: number
  color: string
  index: number
}

function Arc({
  size,
  radius,
  strokeWidth,
  circumference,
  fraction,
  start,
  color,
  index,
}: ArcProps) {
  const grown = useDerivedValue(
    () =>
      withDelay(
        index * 90,
        withTiming(fraction, { duration: Duration.slower, easing: Ease.out })
      ),
    [fraction, index]
  )

  // A 1.5px visual gap between neighbouring segments, expressed as a fraction
  // of the circle so it stays constant whatever the ring's size.
  const gap = arcsGap(circumference)

  const animatedProps = useAnimatedProps(() => {
    const length = Math.max(grown.value * circumference - gap, 0)
    return {
      strokeDasharray: [length, circumference - length],
      strokeDashoffset: -start * circumference,
    }
  })

  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="butt"
      animatedProps={animatedProps}
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
    />
  )
}

function arcsGap(circumference: number): number {
  // Never eat more than a tenth of the ring, so a chart of many tiny segments
  // doesn't disappear into its own gaps.
  return Math.min(3, circumference / 10)
}

const styles = StyleSheet.create({
  ringBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  centerLabel: {
    ...Typography.heading,
    fontFamily: FontFamily.displayBold,
  },
  centerCaption: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },
  withLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  legendLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
})
