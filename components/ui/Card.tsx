import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Elevation, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface CardProps {
  children: ReactNode
  /**
   * surface  → the default flat card sitting on the page (DESIGN.md §4)
   * raised   → lifted off the page with a soft shadow; for content that
   *            genuinely floats (sheets, popovers, the one hero card)
   * outlined → hairline border, no fill; for grouping without adding weight
   */
  variant?: 'surface' | 'raised' | 'outlined'
  padded?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * The card/section container used across deal detail, revenue, settings and
 * the invoice screens — each of which previously hand-rolled its own
 * `styles.card` block with the same three properties.
 */
export function Card({ children, variant = 'surface', padded = true, onPress, style }: CardProps) {
  const { c, isDark } = useTheme()
  const elevation = isDark ? Elevation.dark : Elevation.light

  const boxStyle: StyleProp<ViewStyle> = [
    styles.card,
    variant === 'outlined'
      ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border }
      : { backgroundColor: variant === 'raised' ? c.bgSurfaceRaised : c.bgSurface },
    variant === 'raised' && elevation.sm,
    padded && styles.padded,
    style,
  ]

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={boxStyle} accessibilityRole="button">
        {children}
      </PressableScale>
    )
  }

  return <View style={boxStyle}>{children}</View>
}

export interface CardSectionProps {
  title: string
  /** Right-aligned affordance — an "Edit" link, a count, a status pill. */
  action?: ReactNode
  subtitle?: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * A titled card. Deal detail is a stack of eight of these, so the
 * header/subtitle/action arrangement lives here once rather than being
 * rebuilt per section.
 */
export function CardSection({ title, subtitle, action, children, style }: CardSectionProps) {
  const { c } = useTheme()

  return (
    <Card style={style}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    // Radius tracks surface size: rows 12, tiles and cards 16, the hero 20.
    // This was 12, which made a full-width content card *rounder-cornered*
    // than nothing and squarer than the small tiles beside it.
    borderRadius: Radius.lg,
  },
  padded: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerText: {
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
})
