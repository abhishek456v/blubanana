import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { PressableScale } from './PressableScale'

export interface PeriodPillProps {
  /** The options to cycle through, in order. */
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  /** Sits on a gradient card by default; `ink` is for the page ground. */
  tone?: 'glass' | 'ink'
  style?: StyleProp<ViewStyle>
}

/**
 * The range selector that sits in a gradient card's header.
 *
 * A single pill showing the current range with a short underline beneath it,
 * rather than a segmented control showing all of them. On a card whose whole
 * job is one big figure, three visible tabs put three pieces of chrome above
 * the number and the eye lands on the chrome; one pill states what you are
 * looking at and gets out of the way.
 *
 * Tapping advances to the next option and wraps. That only works while the
 * list is short and ordered, which is the contract: pass two or three ranges
 * in a sequence a person would guess, never an unordered set.
 */
export function PeriodPill({
  options,
  value,
  onChange,
  tone = 'glass',
  style,
}: PeriodPillProps) {
  const index = Math.max(0, options.indexOf(value))
  const next = options[(index + 1) % options.length]

  const isGlass = tone === 'glass'

  return (
    <PressableScale
      onPress={() => onChange(next)}
      haptic="selection"
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={`Range: ${value}. Tap for ${next}.`}
      style={[
        styles.pill,
        isGlass
          ? { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.22)' }
          : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)' },
        style,
      ]}
    >
      {/* Keyed on the value so the label re-mounts and fades when it changes,
          rather than the words swapping in place with no sign anything
          happened on a control whose only feedback is the label itself. */}
      <Animated.View key={value} entering={FadeIn.duration(180)} style={styles.inner}>
        <Text style={styles.label} numberOfLines={1}>
          {value}
        </Text>
        <View style={styles.underline} />
      </Animated.View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    alignItems: 'center',
  },
  inner: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  label: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    color: '#FFFFFF',
  },
  underline: {
    width: 18,
    height: 2,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
  },
})
