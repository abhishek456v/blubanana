import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { Figure } from './Figure'
import { PressableScale } from './PressableScale'

export type MetricTone = 'default' | 'success' | 'warning' | 'danger' | 'accent'

export interface MetricCardProps {
  label: string
  value: number
  format?: (value: number) => string
  /** Small caption under the figure: "3 deals", "vs ₹32,000 last month". */
  caption?: string
  /** Signed percentage. Positive renders green with an up arrow. */
  trend?: number | null
  tone?: MetricTone
  onPress?: () => void
  /** Position in a grid, used to stagger the entrance. */
  index?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The stat tile used across Home, Money and the annual report.
 *
 * A label in caption style above a display-weight number, plus the count-up.
 * The figures here are the reason the creator opens the app (money earned,
 * money owed), so they get the display face and enough room to breathe.
 */
export function MetricCard({
  label,
  value,
  format,
  caption,
  trend,
  tone = 'default',
  onPress,
  index = 0,
  style,
}: MetricCardProps) {
  const { c } = useTheme()

  const valueColor: Record<MetricTone, string> = {
    default: c.textPrimary,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    accent: c.accent,
  }

  const hasTrend = trend != null && Number.isFinite(trend) && trend !== 0
  const trendUp = (trend ?? 0) > 0
  const trendColor = trendUp ? c.success : c.danger

  const body = (
    <>
      <Text style={[styles.label, { color: c.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>

      <Figure
        value={(format ?? String)(value)}
        count
        format={format ?? String}
        size={Typography.display.fontSize}
        color={valueColor[tone]}
        bold
        style={styles.value}
      />

      {hasTrend || caption ? (
        <View style={styles.footer}>
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
          {caption ? (
            <Text style={[styles.caption, { color: c.textMuted }]} numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}
    </>
  )

  const boxStyle = [styles.card, { backgroundColor: c.bgSurface }, style]

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
  // The wrapper carries the flex so the animated entrance doesn't fight the
  // grid's sizing; Reanimated writes transforms onto this node.
  wrapper: {
    flex: 1,
    minWidth: 150,
  },
  card: {
    flex: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xxs,
  },
  label: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  value: {
    marginTop: Spacing.xxs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xxs,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  trendText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
  caption: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
    flexShrink: 1,
  },
})
