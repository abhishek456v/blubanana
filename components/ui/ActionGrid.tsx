import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Duration, staggerDelay } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface GridAction {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  /** One short line under the label. Keep it to three or four words. */
  caption?: string
  /**
   * Fills the tile with the accent. At most one per grid.
   *
   * Four identically-weighted tiles make the creator read all four to choose,
   * which is the "everything is equally important, so nothing is" failure.
   * One filled tile answers "what would I usually do here?" before the others
   * are read at all.
   */
  primary?: boolean
  onPress: () => void
}

export interface ActionGridProps {
  actions: GridAction[]
  /** How many sit on one row. Two on a phone, four on a desktop. */
  columns?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The quick-actions grid.
 *
 * A dashboard that only reports leaves the creator hunting through tabs to act
 * on what it just told her. These are the four things she starts from the home
 * screen, one tap from the number that prompted them.
 *
 * Laid out with percentage widths and wrapping rather than a fixed row, so a
 * five-action grid on a two-column phone wraps instead of squeezing.
 */
// Ink on the amber fill. Dark rather than white: white on #F5A623 is 2.2:1,
// which fails AA, while this clears it comfortably in both themes. The
// accent tile is the same amber on light and dark, so one value serves both.
const ON_ACCENT = '#231A0B'
const ON_ACCENT_MUTED = 'rgba(35,26,11,0.72)'

export function ActionGrid({ actions, columns = 4, style }: ActionGridProps) {
  const { c } = useTheme()

  const basis = `${100 / columns}%` as `${number}%`

  return (
    <View style={[styles.grid, style]}>
      {actions.map((action, index) => (
        <Animated.View
          key={action.label}
          entering={FadeInDown.duration(Duration.slow).delay(staggerDelay(index))}
          style={[styles.cell, { flexBasis: basis, maxWidth: basis }]}
        >
          <PressableScale
            onPress={action.onPress}
            style={[
              styles.tile,
              { backgroundColor: action.primary ? c.accent : c.bgSurface },
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <View
              style={[
                styles.iconBox,
                // On the filled tile the icon plate is a lightened patch of the
                // accent itself, so it reads as one object rather than a chip
                // sitting on a coloured card.
                { backgroundColor: action.primary ? 'rgba(255,255,255,0.28)' : c.accentLight },
              ]}
            >
              <Ionicons
                name={action.icon}
                size={18}
                color={action.primary ? ON_ACCENT : c.accent}
              />
            </View>
            <View style={styles.text}>
              <Text
                style={[styles.label, { color: action.primary ? ON_ACCENT : c.textPrimary }]}
                numberOfLines={1}
              >
                {action.label}
              </Text>
              {action.caption ? (
                <Text
                  style={[
                    styles.caption,
                    { color: action.primary ? ON_ACCENT_MUTED : c.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {action.caption}
                </Text>
              ) : null}
            </View>
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Cancels the cells' outer padding so the grid's edges line up with the
    // cards above and below it.
    margin: -5,
  },
  // Padding on the cell rather than a gap on the grid: a percentage basis plus
  // a flex gap overflows the row, since the gap is added outside the basis.
  cell: {
    padding: Spacing.xs + 2,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    padding: Spacing.base,
    borderRadius: Radius.md,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 1,
  },
  label: {
    ...Typography.bodyStrong,
    fontFamily: FontFamily.semiBold,
  },
  caption: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
})
