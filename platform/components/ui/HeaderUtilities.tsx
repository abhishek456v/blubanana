import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Spacing } from '@/constants/design'
import { NotificationBell } from './NotificationBell'
import { SearchButton } from './SearchButton'

export interface HeaderUtilitiesProps {
  /** Hide the bell on the screen the bell itself opens. */
  showBell?: boolean
  /** Hide search on screens that have their own search field (Brands). */
  showSearch?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * The always-present controls in a screen header: search and reminders.
 *
 * Exists so the cluster is declared once. Every tab screen was going to pass
 * the same components inline, and five copies of that is exactly how the
 * order and spacing drift apart between screens.
 *
 * The day/night toggle used to live here and no longer does (20 Aug
 * redesign). It has two better homes — the sidebar's spelled-out Light/Dark
 * segment on wide screens, and Settings' Appearance control on a phone — and
 * a fourth icon button in the header was pushing the phone's title onto two
 * lines.
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
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
})
