import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface DataTableColumn<Row> {
  key: string
  title: string
  /** Relative width. Defaults to 1. */
  flex?: number
  align?: 'left' | 'right'
  /** Cell contents. Strings get the standard cell text style. */
  render: (row: Row) => ReactNode
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[]
  rows: Row[]
  keyOf: (row: Row) => string
  onRowPress?: (row: Row) => void
  style?: StyleProp<ViewStyle>
}

/**
 * The desktop data table: invoices, and any future screen where the unit of
 * reading is a figure in a column rather than a card.
 *
 * A table and not styled rows: column alignment is the entire point. Right-
 * aligned amounts under a right-aligned header let the eye run down a column
 * of rupees, which a ListRow's trailing block never quite lines up.
 *
 * Desktop-only by convention (DESIGN.md §8: "phones get rows"), so callers
 * branch on `isDesktop` and render their ListRow layout below it. The table
 * does not try to collapse itself responsively; a squeezed table is worse
 * than the rows it replaced.
 */
export function DataTable<Row>({ columns, rows, keyOf, onRowPress, style }: DataTableProps<Row>) {
  const { c } = useTheme()

  return (
    <View
      style={[styles.table, { backgroundColor: c.bgSurface }, style]}
      accessibilityRole="list"
    >
      <View style={[styles.headerRow, { borderBottomColor: c.border }]}>
        {columns.map((column) => (
          <Text
            key={column.key}
            style={[
              styles.headerCell,
              { flex: column.flex ?? 1, color: c.textMuted },
              column.align === 'right' && styles.right,
            ]}
            numberOfLines={1}
          >
            {column.title}
          </Text>
        ))}
      </View>

      {rows.map((row, index) => {
        const cells = (
          <>
            {columns.map((column) => {
              const content = column.render(row)
              return (
                <View
                  key={column.key}
                  style={[
                    styles.cell,
                    { flex: column.flex ?? 1 },
                    column.align === 'right' && styles.cellRight,
                  ]}
                >
                  {typeof content === 'string' || typeof content === 'number' ? (
                    <Text
                      style={[
                        styles.cellText,
                        { color: c.textPrimary },
                        column.align === 'right' && styles.right,
                      ]}
                      numberOfLines={1}
                    >
                      {content}
                    </Text>
                  ) : (
                    content
                  )}
                </View>
              )
            })}
          </>
        )

        const rowStyle = [
          styles.row,
          // Hairline between rows, not around them; the table's card supplies
          // the outer edge.
          index > 0 && { borderTopWidth: 1, borderTopColor: c.border },
        ]

        return (
          <Animated.View
            key={keyOf(row)}
            entering={FadeInDown.duration(Duration.base).delay(staggerDelay(index))}
          >
            {onRowPress ? (
              <PressableScale
                onPress={() => onRowPress(row)}
                scaleTo={0.995}
                style={rowStyle}
                accessibilityRole="button"
              >
                {cells}
              </PressableScale>
            ) : (
              <View style={rowStyle}>{cells}</View>
            )}
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  table: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  headerCell: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    // Denser than a ListRow (DESIGN.md §4): a table's rows are scanned, not
    // read one by one.
    paddingVertical: 11,
    gap: Spacing.sm,
  },
  cell: {
    justifyContent: 'center',
  },
  cellRight: {
    alignItems: 'flex-end',
  },
  cellText: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  right: {
    textAlign: 'right',
  },
})
