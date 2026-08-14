import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Timing } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

export interface ChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  icon?: keyof typeof Ionicons.glyphMap
  tone?: ChipTone
  size?: 'sm' | 'md'
  style?: StyleProp<ViewStyle>
}

const SIZES = {
  sm: { paddingHorizontal: Spacing.sm + 2, height: 26, fontSize: 12, icon: 12 },
  md: { paddingHorizontal: Spacing.md, height: 34, fontSize: 13, icon: 14 },
} as const

/**
 * Selectable pill — the filter rows on the dashboard, the platform picker on
 * both deal screens, and the tag rows on brand detail.
 *
 * Selection cross-fades rather than snapping. With a horizontal filter row
 * that matters: an instant fill on tap makes the row read as a page reload,
 * a 150ms fade makes it read as a control.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  tone = 'accent',
  size = 'md',
  style,
}: ChipProps) {
  const { c } = useTheme()
  const s = SIZES[size]

  const toneColor: Record<ChipTone, string> = {
    neutral: c.textSecondary,
    accent: c.fillPrimary,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    info: c.info,
  }
  const activeBg = toneColor[tone]
  const activeFg = tone === 'accent' ? c.onFillPrimary : c.bgPage

  const progress = useDerivedValue(() => withTiming(selected ? 1 : 0, Timing.fast), [selected])

  const animatedBox = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(0,0,0,0)', activeBg]),
    borderColor: interpolateColor(progress.value, [0, 1], [c.border, activeBg]),
  }))

  const animatedText = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [c.textSecondary, activeFg]),
  }))

  const content = (
    <Animated.View
      style={[
        styles.chip,
        { height: s.height, paddingHorizontal: s.paddingHorizontal },
        animatedBox,
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={s.icon} color={selected ? activeFg : c.textSecondary} />
      ) : null}
      <Animated.Text style={[styles.label, { fontSize: s.fontSize }, animatedText]}>
        {label}
      </Animated.Text>
    </Animated.View>
  )

  if (!onPress) return <View>{content}</View>

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // Chips sit in tight rows; a full 0.97 squeeze on something this small
      // reads as a glitch rather than a press.
      scaleTo={0.94}
    >
      {content}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  label: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
})
