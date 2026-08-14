import { useMemo, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn } from 'react-native-reanimated'
import { FontFamily, HitSlop, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { formatDateLong, parseLocalDate, startOfToday, toDateString } from '@/lib/format'
import { Button } from './Button'
import { Chip } from './Chip'
import { PressableScale } from './PressableScale'
import { Sheet } from './Sheet'

export interface DateFieldProps {
  label?: string
  /** `YYYY-MM-DD`, or null when unset. */
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  error?: string | null
  hint?: string
  clearable?: boolean
  style?: StyleProp<ViewStyle>
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Day-number cells for one month, padded with nulls so the first of the month
 * lands under its real weekday and the grid divides evenly into rows of 7.
 */
function monthCells(year: number, month: number): (number | null)[] {
  const leadingBlanks = new Date(year, month, 1).getDay()
  // Day 0 of the *next* month is the last day of this one.
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = Array(leadingBlanks).fill(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/**
 * Date input.
 *
 * Both deal screens previously asked the creator to hand-type `2025-09-01`
 * into a bare `TextInput` with regex validation — four times each, in a
 * "Timeline" grid. For an app whose entire premise is not missing deadlines,
 * that was the weakest surface in the product.
 *
 * The calendar is built here rather than pulled from
 * `@react-native-community/datetimepicker` because that library renders the
 * OS picker on native and has no real web story, which would mean three
 * different-looking date pickers across the three platforms this app ships
 * to. This one is identical everywhere and themed from the same tokens.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  error,
  hint,
  clearable = true,
  style,
}: DateFieldProps) {
  const { c } = useTheme()
  const [open, setOpen] = useState(false)

  const selected = value ? parseLocalDate(value) : null
  const [cursor, setCursor] = useState(() => selected ?? startOfToday())

  const cells = useMemo(
    () => monthCells(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  )

  const todayStr = toDateString(startOfToday())

  function openPicker() {
    // Always reopen on the selected month rather than wherever the user last
    // browsed to — otherwise editing a date shows an unrelated month.
    setCursor(value ? parseLocalDate(value) : startOfToday())
    setOpen(true)
  }

  function pick(day: number) {
    onChange(toDateString(new Date(cursor.getFullYear(), cursor.getMonth(), day)))
    setOpen(false)
  }

  function shiftMonth(delta: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function pickOffset(daysFromNow: number) {
    const date = startOfToday()
    date.setDate(date.getDate() + daysFromNow)
    onChange(toDateString(date))
    setOpen(false)
  }

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text> : null}

      <PressableScale
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value ?? 'not set'}` : placeholder}
        style={[
          styles.field,
          { backgroundColor: c.bgSurface, borderColor: error ? c.danger : c.borderStrong },
        ]}
      >
        <Ionicons name="calendar-outline" size={17} color={value ? c.accent : c.textMuted} />
        <Text
          style={[styles.valueText, { color: value ? c.textPrimary : c.textMuted }]}
          numberOfLines={1}
        >
          {value ? formatDateLong(value) : placeholder}
        </Text>
        {value && clearable ? (
          <PressableScale
            onPress={() => onChange(null)}
            hitSlop={HitSlop}
            haptic="light"
            accessibilityLabel="Clear date"
          >
            <Ionicons name="close-circle" size={17} color={c.textMuted} />
          </PressableScale>
        ) : null}
      </PressableScale>

      {error ? (
        <Text style={[styles.help, { color: c.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.help, { color: c.textMuted }]}>{hint}</Text>
      ) : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? 'Select date'}>
        <View style={styles.quickRow}>
          <Chip label="Today" onPress={() => pickOffset(0)} />
          <Chip label="Tomorrow" onPress={() => pickOffset(1)} />
          <Chip label="Next week" onPress={() => pickOffset(7)} />
        </View>

        <View style={styles.monthHeader}>
          <PressableScale
            onPress={() => shiftMonth(-1)}
            hitSlop={HitSlop}
            haptic="selection"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={20} color={c.textSecondary} />
          </PressableScale>

          <Text style={[styles.monthTitle, { color: c.textPrimary }]}>
            {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
          </Text>

          <PressableScale
            onPress={() => shiftMonth(1)}
            hitSlop={HitSlop}
            haptic="selection"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
          </PressableScale>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_INITIALS.map((initial, index) => (
            <Text key={index} style={[styles.weekday, { color: c.textMuted }]}>
              {initial}
            </Text>
          ))}
        </View>

        {/* Keyed on the month so navigating re-mounts the grid and it fades
            in, rather than the numbers silently swapping in place. */}
        <Animated.View
          key={`${cursor.getFullYear()}-${cursor.getMonth()}`}
          entering={FadeIn.duration(160)}
          style={styles.grid}
        >
          {cells.map((day, index) => {
            if (day === null) return <View key={`blank-${index}`} style={styles.cell} />

            const dateStr = toDateString(new Date(cursor.getFullYear(), cursor.getMonth(), day))
            const isSelected = dateStr === value
            const isToday = dateStr === todayStr

            return (
              <View key={dateStr} style={styles.cell}>
                <PressableScale
                  onPress={() => pick(day)}
                  haptic="selection"
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.day,
                    isSelected && { backgroundColor: c.fillPrimary },
                    !isSelected && isToday && { borderWidth: 1, borderColor: c.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: isSelected
                          ? c.onFillPrimary
                          : isToday
                            ? c.accent
                            : c.textPrimary,
                        fontFamily: isSelected || isToday ? FontFamily.semiBold : FontFamily.regular,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                </PressableScale>
              </View>
            )
          })}
        </Animated.View>

        {value && clearable ? (
          <Button
            label="Clear date"
            variant="ghost"
            fullWidth
            onPress={() => {
              onChange(null)
              setOpen(false)
            }}
            style={styles.clearAction}
          />
        ) : null}
      </Sheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  valueText: {
    flex: 1,
    ...Typography.body,
    fontFamily: FontFamily.regular,
  },
  help: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  monthTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.display,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 3,
  },
  day: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  clearAction: {
    marginTop: Spacing.sm,
  },
})
