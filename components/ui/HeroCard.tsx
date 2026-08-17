import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography, type GradientName } from '@/constants/design'
import { Duration } from '@/constants/motion'
import { Figure } from './Figure'
import { GradientCard } from './GradientCard'
import { PressableScale } from './PressableScale'

/** Text colours on a gradient card. Fixed, because the ground is fixed. */
const ON_GRADIENT = '#FFFFFF'
const ON_GRADIENT_MUTED = 'rgba(255,255,255,0.62)'
const ON_GRADIENT_FAINT = 'rgba(255,255,255,0.18)'

export interface HeroStat {
  label: string
  value: string
  /** Small dot before the label. Use a status colour, or omit for none. */
  dotColor?: string
}

export interface HeroCardProps {
  /** Small line above the figure: "Owed to you". */
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
  /**
   * Full-width chart between the figure and the footer strip.
   *
   * The card carries the number a creator opens the app for, so the shape
   * behind that number belongs on it rather than in a separate card below.
   * `aside` is beside the figure and stays narrow; this gets the whole width.
   */
  chart?: ReactNode
  /** Which gradient to sit on. `blue` unless the screen already has one. */
  gradient?: GradientName
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * The one gradient card on a screen that leads with a single figure.
 *
 * Where `GradientCard` is the bare surface, this is the standard arrangement
 * on top of it: an eyebrow, one large figure with a sentence under it, an
 * optional chart, and a footer strip of supporting numbers. Screens that need
 * a different arrangement compose `GradientCard` directly, which is what Home
 * and Money do.
 *
 * All text inside is fixed white rather than themed. The card carries its own
 * ground in both themes, so the page's text colours would be wrong on it half
 * the time.
 */
export function HeroCard({
  label,
  value,
  format,
  caption,
  stats,
  action,
  aside,
  chart,
  gradient = 'blue',
  onPress,
  style,
}: HeroCardProps) {
  return (
    <Animated.View entering={FadeInDown.duration(Duration.slow)} style={styles.wrapper}>
      <GradientCard
        gradient={gradient}
        onPress={onPress}
        style={[styles.card, style]}
        accessibilityLabel={label}
        action={
          action ? (
            // A ghost pill rather than a circular button: this one carries a
            // word, and the disc is reserved for the icon-only affordance.
            <PressableScale
              onPress={action.onPress}
              style={[styles.ghost, { backgroundColor: ON_GRADIENT_FAINT }]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text style={styles.ghostText}>{action.label}</Text>
              <Ionicons name="arrow-forward" size={13} color={ON_GRADIENT} />
            </PressableScale>
          ) : null
        }
        title={undefined}
      >
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>

        <View style={styles.figureRow}>
          <View style={styles.figureBlock}>
            <Figure
              value={(format ?? String)(value)}
              // The one figure on the screen that earns a count-up.
              count
              format={format ?? String}
              size={40}
              color={ON_GRADIENT}
              bold
            />
            {caption ? (
              <Text style={styles.caption} numberOfLines={2}>
                {caption}
              </Text>
            ) : null}
          </View>

          {aside ? <View style={styles.aside}>{aside}</View> : null}
        </View>

        {chart ? <View style={styles.chart}>{chart}</View> : null}

        {stats?.length ? (
          <View style={[styles.stats, { borderTopColor: ON_GRADIENT_FAINT }]}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <View style={styles.statLabelRow}>
                  {stat.dotColor ? (
                    <View style={[styles.dot, { backgroundColor: stat.dotColor }]} />
                  ) : null}
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {stat.label}
                  </Text>
                </View>
                <Figure value={stat.value} size={16} color={ON_GRADIENT} bold />
              </View>
            ))}
          </View>
        ) : null}
      </GradientCard>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    gap: Spacing.md,
  },
  label: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.4,
    color: ON_GRADIENT_MUTED,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  ghostText: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
    color: ON_GRADIENT,
  },
  // Takes the slack when the card is stretched to a taller neighbour, so the
  // figure centres in the space and the stats strip stays pinned to the
  // bottom edge. Without this the card grew downward into dead space.
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
  caption: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    color: ON_GRADIENT_MUTED,
  },
  chart: {
    marginTop: Spacing.lg,
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
    color: ON_GRADIENT_MUTED,
  },
})
