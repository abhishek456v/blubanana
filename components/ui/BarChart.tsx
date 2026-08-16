import { useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, Ease } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface BarChartDatum {
  label: string
  value: number
}

export interface BarChartProps {
  data: BarChartDatum[]
  height?: number
  formatValue?: (value: number) => string
  /** Called on bar tap. Omit to make the chart display-only. */
  onSelect?: (index: number) => void
  /**
   * Bar drawn at full accent. Defaults to the last one: on a six-month chart
   * that is the current month, which is the bar being read against the others.
   */
  highlightIndex?: number
  /**
   * Bars stop widening past this. Six bars across a desktop card is 130px
   * each otherwise, which reads as a stacked area chart rather than columns.
   */
  maxBarWidth?: number
  /**
   * Grow the plot to whatever height the container gives it, instead of the
   * fixed `height`. For a chart in a bento cell that is stretched to match a
   * taller column; otherwise the card grows and the chart doesn't.
   */
  fill?: boolean
  /**
   * Draw horizontal gridlines and label the top one.
   *
   * Without a scale a bar chart only shows relative shape: one tall bar and
   * five stubs tells you July was the biggest month and nothing about whether
   * that was a good one. The top gridline carries the figure the tallest bar
   * represents, so every other bar can be read against it.
   */
  showScale?: boolean
  /**
   * Colour overrides, for the one place this chart is drawn on an inverted
   * ground. The defaults read from the page theme, which is invisible against
   * `bgContrast`; passing `onContrast` values here keeps a single chart
   * component rather than forking a dark variant of it.
   */
  palette?: {
    bar?: string
    barMuted?: string
    grid?: string
    baseline?: string
    label?: string
    labelActive?: string
  }
  style?: StyleProp<ViewStyle>
}

/**
 * Monthly revenue bars.
 *
 * The Revenue tab previously sized bars with an inline `height: '${pct}%'`
 * computed against `Math.max(...)`, with no labels, no selection and no
 * animation. This keeps that simplicity but adds the three things that make a
 * chart usable: bars that grow on mount so the shape registers, a tap target
 * that reveals the exact figure, and a zero state that doesn't collapse to a
 * flat line.
 *
 * Deliberately built from Views rather than SVG: these are rectangles, and
 * Views give rounded corners and layout-driven sizing for free while
 * animating on the UI thread. SVG is reserved for the curves in `Sparkline`.
 */
export function BarChart({
  data,
  height = 132,
  formatValue = (v) => String(Math.round(v)),
  onSelect,
  highlightIndex,
  maxBarWidth = 52,
  fill = false,
  showScale = true,
  palette,
  style,
}: BarChartProps) {
  const { c } = useTheme()
  const ink = {
    bar: palette?.bar ?? c.accent,
    barMuted: palette?.barMuted ?? c.accentSoft,
    grid: palette?.grid ?? c.border,
    baseline: palette?.baseline ?? c.borderStrong,
    label: palette?.label ?? c.textMuted,
    labelActive: palette?.labelActive ?? c.textPrimary,
  }
  const [selected, setSelected] = useState<number | null>(null)

  const max = Math.max(...data.map((d) => d.value), 0)
  // With no data at all, every bar would be full height from a 0/0 division.
  const safeMax = max > 0 ? max : 1
  const highlighted = highlightIndex ?? data.length - 1

  // Quarter lines. Only drawn when there is something to measure, since a
  // grid over an all-zero chart implies a scale that does not exist.
  const gridlines = showScale && max > 0 ? [1, 0.75, 0.5, 0.25] : []

  return (
    <View style={[fill && styles.fill, style]}>
      <View style={[styles.plot, fill ? styles.fill : { height }]}>
        {gridlines.map((fraction) => (
          <View
            key={fraction}
            pointerEvents="none"
            style={[
              styles.gridline,
              { bottom: `${fraction * 100}%`, backgroundColor: ink.grid },
            ]}
          />
        ))}

        {/* The value the tallest bar stands for. Sits on the top gridline so
            it reads as an axis label rather than a floating number. */}
        {gridlines.length > 0 ? (
          <Text pointerEvents="none" style={[styles.scaleLabel, { color: ink.label }]}>
            {formatValue(max)}
          </Text>
        ) : null}

        {/* A zero month draws a 3px sliver, which alone is ambiguous: it could
            be a tiny value or missing data. The baseline makes it read as a
            month that sat on zero. */}
        <View style={[styles.baseline, { backgroundColor: ink.baseline }]} />

        {data.map((datum, index) => {
          const isSelected = selected === index
          const fraction = datum.value / safeMax

          return (
            <PressableScale
              key={`${datum.label}-${index}`}
              onPress={
                onSelect || datum.value > 0
                  ? () => {
                      setSelected((current) => (current === index ? null : index))
                      onSelect?.(index)
                    }
                  : undefined
              }
              haptic="selection"
              scaleTo={0.95}
              style={styles.column}
              accessibilityRole="button"
              accessibilityLabel={`${datum.label}: ${formatValue(datum.value)}`}
            >
              {isSelected ? (
                <Text style={[styles.tooltip, { color: ink.labelActive }]} numberOfLines={1}>
                  {formatValue(datum.value)}
                </Text>
              ) : null}

              <Bar
                fraction={fraction}
                index={index}
                color={isSelected || index === highlighted ? ink.bar : ink.barMuted}
                maxWidth={maxBarWidth}
                minHeight={3}
              />
            </PressableScale>
          )
        })}
      </View>

      <View style={styles.axis}>
        {data.map((datum, index) => (
          <Text
            key={`${datum.label}-axis-${index}`}
            style={[
              styles.axisLabel,
              { color: selected === index ? ink.labelActive : ink.label },
            ]}
            numberOfLines={1}
          >
            {datum.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

interface BarProps {
  fraction: number
  index: number
  color: string
  minHeight: number
  maxWidth: number
}

function Bar({ fraction, index, color, minHeight, maxWidth }: BarProps) {
  // Bars rise left-to-right rather than all at once, since the sweep is what makes
  // the trend legible before any number is read.
  const grown = useDerivedValue(
    () =>
      withDelay(
        index * 45,
        withTiming(fraction, { duration: Duration.slower, easing: Ease.out })
      ),
    [fraction, index]
  )

  const animatedStyle = useAnimatedStyle(() => ({
    height: `${Math.max(grown.value * 100, 0)}%`,
    backgroundColor: color,
  }))

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.bar, { minHeight, maxWidth }, animatedStyle]} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
  },
  gridline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  scaleLabel: {
    position: 'absolute',
    right: 0,
    top: -6,
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    gap: 4,
  },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: Radius.sm,
  },
  tooltip: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
    textAlign: 'center',
  },
  axis: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  axisLabel: {
    flex: 1,
    ...Typography.label,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
})
