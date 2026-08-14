import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Spacing } from '@/constants/design'
import { NotificationBell } from './NotificationBell'
import { SearchButton } from './SearchButton'
import { ThemeToggle } from './ThemeToggle'

export interface HeaderUtilitiesProps {
  /** Hide the bell on the screen the bell itself opens. */
  showBell?: boolean
  /** Hide search on screens that have their own search field (Brands). */
  showSearch?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * The always-present controls in a screen header: search, reminders, day/night.
 *
 * Exists so the cluster is declared once. Every tab screen was going to pass
 * the same three components inline, and five copies of that is exactly how the
 * order and spacing drift apart between screens.
 *
 * The bell sits between the others because it is the one that changes — a
 * control that sometimes carries a badge should not move the control beside
 * it when the badge appears.
 */
export function HeaderUtilities({
  showBell = true,
  showSearch = true,
  style,
}: HeaderUtilitiesProps) {
  return (
    <View style={[styles.row, style]}>
      {showSearch ? <SearchButton /> : null}
      {showBell ? <NotificationBell /> : null}
      <ThemeToggle />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
})
