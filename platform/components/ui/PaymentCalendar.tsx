import { useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { FontFamily, Radius, Spacing, Typography, accentGlow } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface CalendarMark {
  /** `YYYY-MM-DD`. */
  date: string
  kind: 'due' | 'paid'
}

export interface PaymentCalendarProps {
  /** Which month to draw. Defaults to the current one. */
  month?: Date
  marks: CalendarMark[]
  onSelectDate?: (date: string) => void
  style?: StyleProp<ViewStyle>
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * The month, as dots.
 *
 * A quiet day is a small dot rather than a number: a full grid of numerals
 * gives every date equal weight, when the only ones that matter are the four
 * or five with money attached. The dots keep the shape of the month legible
 * so the marked days can be read as "the 3rd" without counting, while the
 * marks themselves are the only things that carry a numeral.
 *
 * Two kinds, and they must stay visually different: `due` is money expected
 * (the accent) and `paid` is money that arrived (green). Today gets a ring
 * rather than a fill, so it never competes with a payment.
 *
 * Dates are `YYYY-MM-DD` strings compared as strings, not parsed. Every date
 * in this app is a local calendar day; running them through `Date` to compare
 * them is what puts a payment on the wrong day for anyone east of UTC.
 */
export function PaymentCalendar({
  month,
  marks,
  onSelectDate,
  style,
}: PaymentCalendarProps) {
  const { c } = useTheme()
  const now = month ?? new Date()

  const { cells, todayStr } = useMemo(() => {
    const year = now.getFullYear()
    const monthIndex = now.getMonth()
    const first = new Date(year, monthIndex, 1)
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const leading = first.getDay()

    const pad = (n: number) => String(n).padStart(2, '0')
    const prefix = `${year}-${pad(monthIndex + 1)}-`

    const byDate = new Map<string, CalendarMark['kind']>()
    for (const mark of marks) {
      // `paid` wins a day that carries both: money that arrived is settled,
      // and showing it as still due would be wrong.
      if (mark.kind === 'paid' || !byDate.has(mark.date)) byDate.set(mark.date, mark.kind)
    }

    const list: ({ day: number; date: string; kind?: CalendarMark['kind'] } | null)[] = []
    for (let i = 0; i < leading; i += 1) list.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${prefix}${pad(day)}`
      list.push({ day, date, kind: byDate.get(date) })
    }

    const today = new Date()
    return {
      cells: list,
      todayStr: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    }
  }, [now, marks])

  return (
    <View style={style}>
      <View style={styles.grid}>
        {WEEKDAYS.map((day, index) => (
          <View key={`${day}-${index}`} style={styles.cell}>
            <Text style={[styles.weekday, { color: c.textMuted }]}>{day}</Text>
          </View>
        ))}

        {cells.map((cell, index) => {
          if (!cell) return <View key={`pad-${index}`} style={styles.cell} />

          const isToday = cell.date === todayStr
          const marked = cell.kind != null

          const fill =
            cell.kind === 'paid' ? c.success : cell.kind === 'due' ? c.accent : 'transparent'

          const body = marked ? (
            <View
              style={[
                styles.mark,
                { backgroundColor: fill },
                cell.kind === 'due' && accentGlow(0.35),
              ]}
            >
              <Text style={styles.markText} allowFontScaling={false}>
                {cell.day}
              </Text>
            </View>
          ) : isToday ? (
            <View style={[styles.mark, styles.todayRing, { borderColor: c.textPrimary }]}>
              <Text
                style={[styles.markText, { color: c.textPrimary }]}
                allowFontScaling={false}
              >
                {cell.day}
              </Text>
            </View>
          ) : (
            <View style={[styles.dot, { backgroundColor: c.textMuted }]} />
          )

          // Today plus a payment: the ring would be hidden under the fill, so
          // the marked day keeps its fill and takes an outline instead.
          const showTodayOutline = isToday && marked

          return (
            <View key={cell.date} style={styles.cell}>
              {onSelectDate && marked ? (
                <PressableScale
                  onPress={() => onSelectDate(cell.date)}
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={`${cell.day}, ${cell.kind === 'paid' ? 'money in' : 'payment due'}`}
                  style={showTodayOutline ? [styles.outline, { borderColor: c.textPrimary }] : undefined}
                >
                  {body}
                </PressableScale>
              ) : (
                <View
                  style={showTodayOutline ? [styles.outline, { borderColor: c.textPrimary }] : undefined}
                >
                  {body}
                </View>
              )}
            </View>
          )
        })}
      </View>

      <View style={styles.legend}>
        <Legend color={c.accent} label="Payment due" />
        <Legend color={c.success} label="Money in" />
        <Legend outline={c.textPrimary} label="Today" />
      </View>
    </View>
  )
}

function Legend({
  color,
  outline,
  label,
}: {
  color?: string
  outline?: string
  label: string
}) {
  const { c } = useTheme()
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          outline
            ? { borderWidth: 1.5, borderColor: outline }
            : { backgroundColor: color },
        ]}
      />
      <Text style={[styles.legendLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    // Seven columns. A percentage rather than flex: wrapped rows do not
    // distribute, so each cell has to carry its own width.
    width: `${100 / 7}%`,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: Radius.full,
    opacity: 0.35,
  },
  mark: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  todayRing: {
    borderWidth: 1.5,
  },
  outline: {
    borderWidth: 1.5,
    borderRadius: Radius.full,
    padding: 1.5,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
    marginTop: Spacing.base,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  legendLabel: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
    fontSize: 10,
  },
})
