import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { HitSlop, Radius } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { Figure } from './Figure'
import { PressableScale } from './PressableScale'

export type CircleButtonTone = 'light' | 'glass' | 'ink'

export interface CircleButtonProps {
  icon: keyof typeof Ionicons.glyphMap
  /**
   * Omit to render a plain disc rather than a control.
   *
   * That is the correct form when the whole card is the tap target: a
   * `Pressable` inside a `Pressable` produces a nested `<button>` on web,
   * which is invalid HTML and warns at render. The disc still reads as the
   * affordance; the card underneath is what actually takes the press.
   */
  onPress?: () => void
  /**
   * Degrees to turn the glyph, for arrows that need to point somewhere
   * Ionicons has no icon for (there is no diagonal arrow in the set).
   *
   * Rotating the button instead of the glyph does not work: `PressableScale`
   * appends its own animated `transform` after the caller's style, and a
   * transform array replaces rather than merges, so the rotation is silently
   * dropped.
   */
  iconRotate?: number
  /**
   * light → solid white disc with a dark glyph. The one affordance on a
   *          gradient card, and the brightest thing on it.
   * glass → translucent white over whatever is behind. For secondary controls
   *          on a gradient card, which must not compete with `light`.
   * ink   → solid dark disc with a light glyph. For use on the page ground
   *          rather than on a card.
   */
  tone?: CircleButtonTone
  size?: number
  /** Required even for a plain disc, so a caller cannot forget it on a control. */
  accessibilityLabel: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * The circular icon button that sits in a gradient card's top-right corner.
 *
 * A white disc on a saturated gradient is the highest-contrast element the
 * system has, so there is at most one `light` button per card: it is what
 * tells the eye the card is a door rather than a readout. Anything else on
 * the card that needs pressing takes `glass`.
 */
export function CircleButton({
  icon,
  onPress,
  iconRotate,
  tone = 'light',
  size = 44,
  accessibilityLabel,
  disabled = false,
  style,
}: CircleButtonProps) {
  const { c } = useTheme()

  const surface =
    tone === 'light'
      ? '#FFFFFF'
      : tone === 'glass'
        ? 'rgba(255,255,255,0.16)'
        : c.bgSurfaceRaised

  const glyph = tone === 'light' ? '#0B0B12' : tone === 'glass' ? '#FFFFFF' : c.textPrimary

  const disc: StyleProp<ViewStyle> = [
    styles.button,
    {
      width: size,
      height: size,
      borderRadius: Radius.full,
      backgroundColor: surface,
      opacity: disabled ? 0.4 : 1,
    },
    // Only the glass tone needs an edge: a white disc defines its own, and a
    // border on it reads as a ring.
    tone === 'glass' && styles.glassEdge,
    style,
  ]

  const content = (
    <View style={iconRotate ? { transform: [{ rotate: `${iconRotate}deg` }] } : undefined}>
      <Ionicons name={icon} size={Math.round(size * 0.42)} color={glyph} />
    </View>
  )

  if (!onPress) {
    return (
      <View style={disc} accessible={false} importantForAccessibility="no-hide-descendants">
        {content}
      </View>
    )
  }

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={HitSlop}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={disc}
    >
      {content}
    </PressableScale>
  )
}

export interface CountBadgeProps {
  count: number
  size?: number
  /**
   * `contrast` inverts against the page and is the default. `light` pins the
   * disc white for use on a gradient card, where the page's contrast colour
   * would be the wrong one in the light theme.
   */
  tone?: 'contrast' | 'light'
  style?: StyleProp<ViewStyle>
}

/**
 * The disc carrying a count, used at the right edge of a list row.
 *
 * Shares the button's geometry deliberately: on a row that also has a circular
 * button, a differently-sized badge makes the row look misaligned even when
 * both are vertically centred.
 *
 * It inverts against the page rather than always being white. A white disc is
 * correct on the near-black dark theme and invisible on the light one, where
 * the card underneath it is also white.
 */
export function CountBadge({ count, size = 34, tone = 'contrast', style }: CountBadgeProps) {
  const { c } = useTheme()
  const surface = tone === 'light' ? '#FFFFFF' : c.bgContrast
  const ink = tone === 'light' ? '#0B0B12' : c.onContrast

  return (
    <View
      style={[
        styles.button,
        { width: size, height: size, borderRadius: Radius.full, backgroundColor: surface },
        style,
      ]}
    >
      <Figure value={String(count)} size={Math.round(size * 0.44)} color={ink} bold />
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassEdge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
})
