import { useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated'
import { Elevation, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { Spring } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from './PressableScale'

export interface SegmentOption<T extends string> {
  key: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  style?: StyleProp<ViewStyle>
}

const TRACK_PADDING = 3

/**
 * iOS-style segmented control with a sliding thumb.
 *
 * For 2–4 mutually exclusive views (the intake mode switcher, revenue period
 * toggles). Beyond four, use a `Chip` row instead — the labels get too tight
 * to read and the thumb travel stops tracking the eye.
 *
 * The thumb slides between segments rather than jumping. That continuity is
 * the entire reason to reach for this over a row of chips: it tells the user
 * the options are one dimension, not independent switches.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const { c, isDark } = useTheme()
  const [trackWidth, setTrackWidth] = useState(0)

  const activeIndex = Math.max(0, options.findIndex((option) => option.key === value))
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0

  const offset = useDerivedValue(
    () => withSpring(activeIndex * segmentWidth, Spring.snappy),
    [activeIndex, segmentWidth]
  )

  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: offset.value }],
  }))

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: c.bgSurface }, style]}
      accessibilityRole="tablist"
    >
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: c.bgSurfaceRaised },
            isDark ? Elevation.dark.sm : Elevation.light.sm,
            thumbStyle,
          ]}
        />
      ) : null}

      {options.map((option) => {
        const isActive = option.key === value
        return (
          <PressableScale
            key={option.key}
            onPress={() => onChange(option.key)}
            haptic="selection"
            // The thumb already provides the press feedback; scaling the
            // label too would fight it.
            scaleTo={1}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={styles.segment}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? c.textPrimary : c.textSecondary,
                  fontFamily: isActive ? FontFamily.semiBold : FontFamily.medium,
                },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: Radius.sm + 2,
    padding: TRACK_PADDING,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: Radius.sm,
  },
  segment: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  label: {
    ...Typography.caption,
    fontFamily: FontFamily.semiBold,
  },
})
