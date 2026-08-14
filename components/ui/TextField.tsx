import { forwardRef, type ReactNode } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Animated, {
  FadeInDown,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Timing } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string
  /** Inline validation message. Its presence turns the field red. */
  error?: string | null
  /** Persistent helper text. Hidden while an error is showing. */
  hint?: string
  /** Static leading text inside the field — the ₹ on every rate input. */
  prefix?: string
  trailing?: ReactNode
  containerStyle?: StyleProp<ViewStyle>
  inputStyle?: StyleProp<TextStyle>
}

/**
 * The app's one text input.
 *
 * Six screens (deal/new, deal/[id], profile/edit, invoice/new, brand/new,
 * brand/[id]) each declared an identical local `inputStyle` constant before
 * this existed. Beyond deduplication it adds what none of them had: an
 * animated focus ring, a real error state, and a ₹ prefix that doesn't drift
 * out of alignment between screens.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    error,
    hint,
    prefix,
    trailing,
    containerStyle,
    inputStyle,
    multiline,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const { c } = useTheme()
  const focus = useSharedValue(0)

  // Border colour is driven off a shared value rather than React state so the
  // transition runs on the UI thread — a focus ring that lags the keyboard
  // opening is worse than no transition at all.
  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [error ? c.danger : c.borderStrong, error ? c.danger : c.accent]
    ),
  }))

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text> : null}

      <Animated.View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          { backgroundColor: c.bgSurface },
          animatedBorder,
        ]}
      >
        {prefix ? <Text style={[styles.prefix, { color: c.textSecondary }]}>{prefix}</Text> : null}

        <TextInput
          ref={ref}
          {...rest}
          multiline={multiline}
          placeholderTextColor={c.textMuted}
          style={[styles.input, { color: c.textPrimary }, multiline && styles.inputMultiline, inputStyle]}
          onFocus={(e) => {
            focus.value = withTiming(1, Timing.fast)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, Timing.fast)
            onBlur?.(e)
          }}
        />

        {trailing}
      </Animated.View>

      {error ? (
        <Animated.Text
          entering={FadeInDown.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[styles.help, { color: c.danger }]}
        >
          {error}
        </Animated.Text>
      ) : hint ? (
        <Text style={[styles.help, { color: c.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  )
})

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
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm + 2,
    minHeight: 88,
  },
  prefix: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  input: {
    flex: 1,
    ...Typography.body,
    fontFamily: FontFamily.regular,
    // Height is owned by the wrapper; without this the input's own intrinsic
    // height fights the 44px minimum and the text sits a pixel or two high.
    paddingVertical: 0,
    // react-native-web renders a focus outline on the DOM input by default,
    // which would sit inside our own animated ring. `outlineWidth: 0` alone is
    // not enough: Chrome's default is `outline: auto`, which ignores the
    // width, so the style must be `none`. RN's StyleSheet types don't carry
    // `outlineStyle`, hence the cast.
    outlineWidth: 0,
    ...({ outlineStyle: 'none' } as object),
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 64,
  },
  help: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
})
