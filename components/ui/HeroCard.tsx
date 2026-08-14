import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Elevation, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { AnimatedNumber } from './AnimatedNumber'
import { PressableScale } from './PressableScale'

export interface HeroStat {
  label: string
  value: string
  /** Small dot before the label. Use a status colour, or omit for none. */
  dotColor?: string
}

export interface HeroCardProps {
  /** Small line above the figure — "Owed to you". */
  label: string
  value: number
  format?: (value: number) => string
  /** One sentence under the figure saying what the number means today. */
  caption?: string
  /** Up to three figures on the footer strip, under a hairline. */
  stats?: HeroStat[]
  /** Ghost button in the top-right. */
  action?: { label: string; onPress: () => void }
  /** Chart or ring rendered to the right of the figure on wide layouts. */
  aside?: ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * The one inverted card on a screen (DESIGN.md §2).
 *
 * `StatTile contrast` gave the right colour but the wrong weight — it is the
 * same size as the tiles beside it, so the most important number on the screen
 * read as one of four equals. This is deliberately bigger: a 40px figure, a
 * footer strip of supporting numbers, and room for a chart, so the eye lands
 * here first and everything else is read in relation to it.
 *
 * Near-black on the light theme, cream on the dark one. All text inside uses
 * `onContrast`, never `textPrimary` — the ground is inverted, so the page's
 * text colours would vanish into it.
 */
export function HeroCard({
  label,
  value,
  format,
  caption,
  stats,
  action,
  aside,
  onPress,
  style,
}: HeroCardProps) {
  const { c, isDark } = useTheme()
  const elevation = isDark ? Elevation.dark : Elevation.light

  const body = (
    <>
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: c.onContrastMuted }]} numberOfLines={1}>
          {label}
        </Text>

        {action ? (
          <PressableScale
            onPress={action.onPress}
            style={[styles.ghost, { backgroundColor: c.onContrastFaint }]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={[styles.ghostText, { color: c.onContrast }]}>{action.label}</Text>
            <Ionicons name="arrow-forward" size={13} color={c.onContrast} />
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.figureRow}>
        <View style={styles.figureBlock}>
          <AnimatedNumber
            value={value}
            format={format}
            // The one figure on the screen that earns a count-up.
            countOnMount
            duration={900}
            style={[styles.value, { color: c.onContrast }]}
            numberOfLines={1}
          />
          {caption ? (
            <Text style={[styles.caption, { color: c.onContrastMuted }]} numberOfLines={2}>
              {caption}
            </Text>
          ) : null}
        </View>

        {aside ? <View style={styles.aside}>{aside}</View> : null}
      </View>

      {stats?.length ? (
        <View style={[styles.stats, { borderTopColor: c.onContrastFaint }]}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <View style={styles.statLabelRow}>
                {stat.dotColor ? (
                  <View style={[styles.dot, { backgroundColor: stat.dotColor }]} />
                ) : null}
                <Text style={[styles.statLabel, { color: c.onContrastMuted }]} numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
              <Text style={[styles.statValue, { color: c.onContrast }]} numberOfLines={1}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  )

  const boxStyle = [
    styles.card,
    { backgroundColor: c.bgContrast },
    elevation.sm,
    style,
  ]

  return (
    <Animated.View entering={FadeInDown.duration(Duration.slow)} style={styles.wrapper}>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          scaleTo={0.99}
          style={boxStyle}
          accessibilityRole="button"
        >
          {body}
        </PressableScale>
      ) : (
        <View style={boxStyle}>{body}</View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg - 2,
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.4,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  ghostText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
  },
  // Takes the slack when the card is stretched to a taller neighbour, so the
  // figure centres in the space and the stats strip stays pinned to the
  // bottom edge. Without this the card grew downward into dead black.
  figureRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  figureBlock: {
    flex: 1,
    gap: 4,
  },
  value: {
    fontFamily: FontFamily.displayBold,
    fontSize: 40,
    lineHeight: 47,
  },
  caption: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  aside: {
    alignItems: 'flex-end',
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: Spacing.md - 2,
    gap: Spacing.md,
  },
  stat: {
    flex: 1,
    gap: 3,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  statLabel: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  statValue: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.display,
    fontSize: 16,
  },
})
