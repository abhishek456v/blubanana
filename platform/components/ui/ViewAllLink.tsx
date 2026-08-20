import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FontFamily, HitSlop, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface ViewAllLinkProps {
  label?: string
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * "View all >", the way out of every capped list.
 *
 * Deliberately a text link and not a button: it sits *inside* a panel, and a
 * filled pill with a shadow on top of a card is the boxes-inside-boxes look
 * the 20 Aug redesign set out to remove. The accent colour and the chevron
 * are enough to read as tappable; the shadow was doing nothing except
 * competing with the panel it sat on.
 *
 * Every list in the app caps at six rows and ends in one of these.
 */
export function ViewAllLink({ label = 'View all', onPress, style }: ViewAllLinkProps) {
  const { c } = useTheme()

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      hitSlop={HitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.link, style]}
    >
      <Text style={[styles.label, { color: c.accentText }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={12} color={c.accentText} />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  label: {
    ...Typography.caption,
    fontFamily: FontFamily.semiBold,
  },
})
