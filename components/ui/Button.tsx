import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, accentGlow } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'
import type { HapticKind } from '@/lib/haptics'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: keyof typeof Ionicons.glyphMap
  iconPosition?: 'left' | 'right'
  loading?: boolean
  disabled?: boolean
  /** Stretches to the container width. Off by default so buttons hug content. */
  fullWidth?: boolean
  haptic?: HapticKind | false
  style?: StyleProp<ViewStyle>
}

// DESIGN.md §4 fixes the primary button at 44px (the iOS minimum touch
// target). sm/lg scale around that for dense rows and hero actions.
const SIZES = {
  sm: { height: 36, paddingHorizontal: Spacing.md, fontSize: 13, icon: 15, gap: Spacing.sm },
  md: { height: 44, paddingHorizontal: Spacing.lg, fontSize: 15, icon: 17, gap: Spacing.sm },
  lg: { height: 52, paddingHorizontal: Spacing.lg + Spacing.xs, fontSize: 16, icon: 19, gap: Spacing.sm },
} as const

/**
 * The app's one button. Replaces the bespoke `saveButton` / `primaryButton` /
 * `submitButton` StyleSheet blocks that were re-declared in every form screen.
 *
 * While `loading`, the label stays mounted at zero opacity and the spinner
 * overlays it, so the button never changes width mid-submit — a resize on tap
 * is the single most common way a form gives away that it isn't native.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = 'light',
  style,
}: ButtonProps) {
  const { c, isDark } = useTheme()
  const s = SIZES[size]
  const isDisabled = disabled || loading

  const tone: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.fillPrimary, fg: c.onFillPrimary },
    secondary: { bg: 'transparent', fg: c.textPrimary, border: c.borderStrong },
    ghost: { bg: 'transparent', fg: c.accent },
    danger: { bg: c.dangerLight, fg: c.danger },
  }
  const { bg, fg, border } = tone[variant]

  const iconNode = icon ? <Ionicons name={icon} size={s.icon} color={fg} /> : null

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.paddingHorizontal,
          backgroundColor: bg,
          borderColor: border ?? 'transparent',
          borderWidth: border ? 1 : 0,
          opacity: isDisabled ? 0.45 : 1,
        },
        fullWidth && styles.fullWidth,
        // The soft accent halo DESIGN.md §5 permits on primary actions —
        // dropped while disabled so a dead button doesn't glow.
        variant === 'primary' && !isDisabled && accentGlow(isDark ? 0.3 : 0.28),
        style,
      ]}
    >
      <View style={[styles.content, { gap: s.gap, opacity: loading ? 0 : 1 }]}>
        {iconPosition === 'left' ? iconNode : null}
        <Text
          style={[styles.label, { color: fg, fontSize: s.fontSize }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {iconPosition === 'right' ? iconNode : null}
      </View>

      {loading ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(120)}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <View style={styles.content}>
            <ActivityIndicator size="small" color={fg} />
          </View>
        </Animated.View>
      ) : null}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FontFamily.semiBold,
  },
})
