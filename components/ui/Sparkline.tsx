import { useMemo, useState } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useTheme } from '@/hooks/useTheme'

export interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  /** Flat translucent fill under the line. Not a gradient — DESIGN.md §6. */
  filled?: boolean
  /** Marks the final point with a dot — "where you are now". */
  showEndPoint?: boolean
  style?: StyleProp<ViewStyle>
}

interface Point {
  x: number
  y: number
}

/**
 * Converts points to a smooth cubic path via Catmull-Rom.
 *
 * A straight polyline through monthly figures reads as jagged noise; the
 * spline reads as a trend, which is the only thing a sparkline is for. Each
 * segment's control points are derived from the neighbouring points, so the
 * curve passes exactly through every value rather than approximating them.
 */
function smoothPath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let d = `M ${points[0].x} ${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const previous = points[i - 1] ?? points[i]
    const current = points[i]
    const next = points[i + 1]
    const after = points[i + 2] ?? next

    // Catmull-Rom → cubic Bézier. The /6 is the standard conversion factor
    // for a uniform (tension 0.5) Catmull-Rom spline.
    const cp1x = current.x + (next.x - previous.x) / 6
    const cp1y = current.y + (next.y - previous.y) / 6
    const cp2x = next.x - (after.x - current.x) / 6
    const cp2y = next.y - (after.y - current.y) / 6

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`
  }

  return d
}

/**
 * Compact trend line — follower growth, engagement over time, rate history.
 *
 * SVG here rather than Views (unlike `BarChart`) because a smooth curve is
 * exactly what a path is for and cannot be faked with rectangles.
 */
export function Sparkline({
  values,
  width,
  height = 44,
  color,
  filled = true,
  showEndPoint = true,
  style,
}: SparklineProps) {
  const { c } = useTheme()
  const stroke = color ?? c.accent

  // Width is measured rather than required, so callers can drop a sparkline
  // into a flex row without computing pixels.
  const [measuredWidth, setMeasuredWidth] = useState(width ?? 0)
  const chartWidth = width ?? measuredWidth

  const { line, area, endPoint } = useMemo(() => {
    if (chartWidth <= 0 || values.length === 0) {
      return { line: '', area: '', endPoint: null as Point | null }
    }

    const min = Math.min(...values)
    const max = Math.max(...values)
    // A flat series has no range to normalise against; centre it instead of
    // dividing by zero.
    const range = max - min || 1
    const padding = 3

    const points: Point[] = values.map((value, index) => ({
      x: values.length === 1 ? chartWidth / 2 : (index / (values.length - 1)) * chartWidth,
      y: padding + (1 - (value - min) / range) * (height - padding * 2),
    }))

    const linePath = smoothPath(points)
    const areaPath = linePath
      ? `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
      : ''

    return { line: linePath, area: areaPath, endPoint: points[points.length - 1] }
  }, [values, chartWidth, height])

  return (
    <View
      style={[{ height }, width ? { width } : { flex: 1 }, style]}
      onLayout={width ? undefined : (e) => setMeasuredWidth(e.nativeEvent.layout.width)}
    >
      {chartWidth > 0 && line ? (
        <Svg width={chartWidth} height={height}>
          {filled ? <Path d={area} fill={stroke} fillOpacity={0.12} /> : null}
          <Path
            d={line}
            stroke={stroke}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {showEndPoint && endPoint ? (
            <Circle cx={endPoint.x} cy={endPoint.y} r={3.5} fill={stroke} />
          ) : null}
        </Svg>
      ) : null}
    </View>
  )
}
