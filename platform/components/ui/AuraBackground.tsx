import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Gradients, withAlpha } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'

/**
 * The ambient wash behind a screen that has no data to put on a card.
 *
 * The identity lives in the gradient cards, which need something to be a card
 * *about*. Sign-in has one form and no figures, so it would otherwise be the
 * only screen in the app with none of the system on it — technically
 * consistent, visibly unrelated.
 *
 * Both layers are full-bleed, and the falloff is carried entirely by alpha
 * stops. The obvious construction — an oversized box pushed off-canvas so only
 * its falloff shows — does not survive: the box keeps its own hard edge on
 * web, and the wash renders as two visible rectangles across the screen. A
 * gradient that fills the viewport has no edge to leak, so the only thing that
 * can show is the ramp.
 *
 * The stops are placed so both layers reach zero around the middle band, which
 * is where the form sits. Light pooling in the corners leaves the words on the
 * flat page colour instead of dragging their contrast around.
 *
 * Light theme gets a much weaker wash: the same alpha that reads as a glow on
 * near-black reads as a stain on a near-white ground.
 */
export function AuraBackground() {
  const { isDark } = useTheme()
  const strength = isDark ? 1 : 0.35

  const blue = Gradients.blue.colors[1]
  const magenta = Gradients.magenta.colors[0]

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[withAlpha(blue, 0.5 * strength), withAlpha(blue, 0)]}
        locations={[0, 0.62]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[withAlpha(magenta, 0), withAlpha(magenta, 0.32 * strength)]}
        locations={[0.42, 1]}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}
