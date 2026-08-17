import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Radius, Spacing } from '@/constants/design'

export interface DotGridProps {
  /** One entry per column, in chronological order. Any scale; normalised here. */
  values: readonly number[]
  rows?: number
  /** Filled-dot colour. Defaults to the on-gradient white. */
  color?: string
  /** Outline colour of the unfilled dots, which the filled ones read against. */
  trackColor?: string
  dot?: number
  /** Highlights one column, for the period the card's figure refers to. */
  activeIndex?: number | null
  style?: StyleProp<ViewStyle>
}

/**
 * A bar chart drawn as a dot matrix.
 *
 * Columns fill from the bottom in proportion to their value, so the texture is
 * a real reading of the series rather than decoration: the tallest stack is
 * the biggest month, and an empty column is a month with nothing in it. That
 * distinction matters, because a scattered dot field that encodes nothing is
 * the version of this that looks identical and lies.
 *
 * Resolution is deliberately coarse. With four rows a column can only say
 * "none, low, mid, high", which is all a glanceable card should claim; a
 * screen that needs the actual numbers compared uses `BarChart`, where the
 * bars are continuous and carry an axis.
 */
export function DotGrid({
  values,
  rows = 4,
  color = '#FFFFFF',
  trackColor = 'rgba(255,255,255,0.45)',
  dot = 9,
  activeIndex = null,
  style,
}: DotGridProps) {
  const peak = Math.max(...values, 0)

  return (
    <View style={[styles.grid, style]} accessibilityRole="image">
      {values.map((value, column) => {
        // Round rather than floor, so a small non-zero month still lights its
        // first dot instead of reading as nothing earned.
        const filled = peak > 0 ? Math.round((value / peak) * rows) : 0
        const isActive = column === activeIndex

        return (
          <View key={column} style={styles.column}>
            {Array.from({ length: rows }, (_, row) => {
              // Rows paint top-down; fills accumulate bottom-up.
              const isFilled = rows - row <= filled
              return (
                <View
                  key={row}
                  style={[
                    {
                      width: dot,
                      height: dot,
                      borderRadius: Radius.full,
                    },
                    // Filled versus *hollow*, not filled versus dimmed. Two
                    // opacities of the same disc differ by too little over a
                    // saturated gradient, and the matrix reads as texture
                    // rather than as a reading; an outline against a solid is
                    // a difference in kind and survives any ground.
                    isFilled
                      ? { backgroundColor: color, opacity: isActive ? 1 : 0.88 }
                      : { borderWidth: 1.5, borderColor: trackColor },
                  ]}
                />
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  column: {
    gap: Spacing.sm,
    alignItems: 'center',
  },
})
