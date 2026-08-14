import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface ListRowProps {
  title: string
  subtitle?: string
  /** Third line — deadlines, ad-rights windows, anything de-emphasised. */
  meta?: string
  metaColor?: string
  /** Avatar, icon tile, or anything else pinned to the left edge. */
  leading?: ReactNode
  /** Status pill, amount, or a custom node pinned to the right. */
  trailing?: ReactNode
  onPress?: () => void
  showChevron?: boolean
  /** Position in the list, used to stagger the entrance. */
  index?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The flat row from DESIGN.md §4 — surface background, `radius-md`, no
 * border, sitting directly on the page with a gap rather than stacked inside
 * a bordered card.
 *
 * Generalised from `DealRow` because brands, invoices, attachments and
 * archive entries were all rebuilding the same geometry with slightly
 * different padding. `DealRow` still exists and now composes this.
 */
export function ListRow({
  title,
  subtitle,
  meta,
  metaColor,
  leading,
  trailing,
  onPress,
  showChevron = false,
  index = 0,
  style,
}: ListRowProps) {
  const { c } = useTheme()

  const content = (
    <>
      {leading}

      <View style={styles.center}>
        <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={[styles.meta, { color: metaColor ?? c.textMuted }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>

      {trailing}
      {showChevron ? <Ionicons name="chevron-forward" size={16} color={c.textMuted} /> : null}
    </>
  )

  const boxStyle = [styles.row, { backgroundColor: c.bgSurface }, style]

  return (
    <Animated.View entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(index))}>
      {onPress ? (
        <PressableScale onPress={onPress} style={boxStyle} accessibilityRole="button">
          {content}
        </PressableScale>
      ) : (
        <View style={boxStyle}>{content}</View>
      )}
    </Animated.View>
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
  center: {
    flex: 1,
    gap: Spacing.xxs,
  },
  title: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  subtitle: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  meta: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    marginTop: 1,
  },
})
