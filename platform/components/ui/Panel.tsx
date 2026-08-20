import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { FontFamily, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { Card } from './Card'
import { CountBadge } from './CircleButton'

export interface PanelProps {
  title: string
  /** One short line under the title. */
  subtitle?: string
  /** Number beside the title: how many things are in here. */
  count?: number
  /** Top-right of the head. A `ViewAllLink`, a period pill, a filter. */
  action?: ReactNode
  children: ReactNode
  /** Stretches to fill its cell in a row of unequal panels. */
  fill?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * A titled card: the unit the dashboard is built from.
 *
 * Every screen in the 20 Aug redesign is a strip of figures and then a row of
 * these. Before it existed, each screen drew its own head — a title, a count,
 * a link — and the four of them had drifted into four different sizes and
 * three different orders of the same three elements.
 *
 * The head is one line: title, count, then the action pushed right. A
 * subtitle drops to a second line under the title rather than shrinking the
 * room the action has.
 */
export function Panel({
  title,
  subtitle,
  count,
  action,
  children,
  fill = false,
  style,
}: PanelProps) {
  const { c } = useTheme()

  return (
    <Card dense style={[styles.panel, fill && styles.fill, style]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            {count != null && count > 0 ? <CountBadge count={count} size={22} /> : null}
          </View>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </Card>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.base,
  },
  fill: {
    flex: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headText: {
    flex: 1,
    gap: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.heading,
    fontFamily: FontFamily.display,
    flexShrink: 1,
  },
  subtitle: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
})
