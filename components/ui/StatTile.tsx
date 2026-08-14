import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Elevation, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { AnimatedNumber } from './AnimatedNumber'
import { PressableScale } from './PressableScale'
import { Sparkline } from './Sparkline'

export interface StatTileProps {
  label: string
  value: number
  format?: (value: number) => string
  caption?: string
  /** Signed percentage. Positive is green with an up arrow. */
  trend?: number | null
  /** Draws a sparkline behind the figure. Needs 3+ points to render. */
  series?: number[]
  /**
   * Inverts against the page — near-black on light, cream on dark.
   * DESIGN.md §2: exactly one per screen.
   */
  contrast?: boolean
  tone?: 'default' | 'success' | 'warning' | 'danger'
  onPress?: () => void
  index?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The dashboard stat tile.
 *
 * Replaces `MetricCard`, which rendered a label and a number on a flat surface
 * and nothing else — four of them side by side gave a screen no focal point at
 * all. This adds the three things that make a figure readable at a glance: a
 * trend, a shape, and the option to invert.
 */
export function StatTile({
  label,
  value,
  format,
  caption,
  trend,
  series,
  contrast = false,
  tone = 'default',
  onPress,
  index = 0,
  style,
}: StatTileProps) {
  const { c, isDark } = useTheme()
  const elevation = isDark ? Elevation.dark : Elevation.light

  const toneColor: Record<NonNullable<StatTileProps['tone']>, string> = {
    default: contrast ? c.onContrast : c.textPrimary,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
  }

  // On the contrast card the status hues lose their meaning against the
  // inverted ground, so the figure stays in the on-contrast colour and the
  // caption carries the status signal instead.
  const valueColor = contrast ? c.onContrast : toneColor[tone]
  const labelColor = contrast ? c.onContrastMuted : c.textSecondary
  const captionColor = contrast ? c.onContrastMuted : c.textMuted

  const hasTrend = trend != null && Number.isFinite(trend) && trend !== 0
  const trendUp = (trend ?? 0) > 0
  const trendColor = contrast ? c.onContrast : trendUp ? c.success : c.danger

  const body = (
    <>
      <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>

      <View style={styles.valueRow}>
        <AnimatedNumber
          value={value}
          format={format}
          style={[styles.value, { color: valueColor }]}
          numberOfLines={1}
        />
        {hasTrend ? (
          <View style={styles.trend}>
            <Ionicons
              name={trendUp ? 'trending-up' : 'trending-down'}
              size={13}
              color={trendColor}
            />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {Math.abs(Math.round(trend!))}%
            </Text>
          </View>
        ) : null}
      </View>

      {caption ? (
        <Text style={[styles.caption, { color: captionColor }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}

      {series && series.length > 2 ? (
        <Sparkline
          values={series}
          height={30}
          color={contrast ? c.accent : c.accent}
          showEndPoint={false}
          style={styles.spark}
        />
      ) : null}
    </>
  )

  const boxStyle = [
    styles.tile,
    { backgroundColor: contrast ? c.bgContrast : c.bgSurface },
    contrast && elevation.sm,
    style,
  ]

  return (
    <Animated.View
      entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(index))}
      style={styles.wrapper}
    >
      {onPress ? (
        <PressableScale onPress={onPress} style={boxStyle} accessibilityRole="button">
          {body}
        </PressableScale>
      ) : (
        <View style={boxStyle}>{body}</View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // The wrapper carries the flex so Reanimated's transform doesn't fight the
  // grid's sizing.
  wrapper: {
    flex: 1,
    minWidth: 148,
  },
  tile: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md + 2,
    gap: 3,
  },
  label: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  value: {
    fontFamily: FontFamily.displayBold,
    fontSize: 26,
    lineHeight: 32,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
  caption: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  spark: {
    marginTop: Spacing.sm,
  },
})
