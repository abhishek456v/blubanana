import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native'
import { FigureSize, FontFamily } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'

export interface FigureProps {
  /** Already-formatted text (`₹3,75,000`, `28`, `+14%`). */
  value: string
  /**
   * Tween to `value` when it changes, counting the delta.
   *
   * Only meaningful when the text is a plain number; it parses the digits out,
   * animates them and re-runs `format`. Off by default, and it should stay off
   * for a grid of tiles: a screen where every figure spins at once reads as a
   * slot machine rather than as data.
   */
  count?: boolean
  /** Rebuilds the display string from a tweened number. Required by `count`. */
  format?: (value: number) => string
  size?: keyof typeof FigureSize | number
  color?: string
  /** Heavier dot weight, for the one figure a card is actually about. */
  bold?: boolean
  style?: StyleProp<TextStyle>
  numberOfLines?: number
  accessibilityLabel?: string
}

/**
 * A number, set as a display figure.
 *
 * Still the only correct way to render an amount, a count or a percentage: it
 * owns the size scale, the tabular figures and the count-up, and a screen that
 * sets `fontFamily: FontFamily.figure` by hand gets none of them.
 *
 * It used to own something else as well. Figures were set in Doto, a
 * dot-matrix face with no ₹ glyph (U+20B9 is absent from its cmap), so every
 * string had to be split into dotted and non-dotted runs and the rupee sign
 * set separately in the sans at 0.72 size — otherwise `₹3,75,000` rendered its
 * symbol in whatever face the platform happened to pick, differently on web and
 * on device. Google Sans Flex contains ₹, so the whole mechanism is gone and a
 * figure is one run of one font again.
 */
export function Figure({
  value,
  count = false,
  format,
  size = 'md',
  color,
  bold = false,
  style,
  numberOfLines = 1,
  accessibilityLabel,
}: FigureProps) {
  const { c } = useTheme()
  const fontSize = typeof size === 'number' ? size : FigureSize[size]
  const resolved = color ?? c.textPrimary

  const displayed = useCountUp(value, count, format)

  return (
    <Text
      style={[
        styles.base,
        { fontSize, color: resolved, fontFamily: bold ? FontFamily.figureBold : FontFamily.figure },
        style,
      ]}
      numberOfLines={numberOfLines}
      // A caller that formats "3.8L" wants "3.8 lakh" announced rather than the
      // abbreviation, which a screen reader would spell out.
      accessibilityLabel={accessibilityLabel ?? value}
    >
      {displayed}
    </Text>
  )
}

/**
 * Tweens the numeric part of a formatted string.
 *
 * Driven from JS rather than Reanimated: animating text content on the UI
 * thread means the `useAnimatedProps` + `TextInput.text` trick, which
 * react-native-web does not implement. These are a handful of figures per
 * screen, not a scroll-linked effect, so one rAF loop each costs nothing and
 * behaves identically on all three platforms.
 *
 * First paint is never animated. Landing on a screen where every figure is
 * spinning up from zero reads as a slot machine; the count is only worth
 * anything when it shows a change the viewer was present for.
 */
function useCountUp(value: string, enabled: boolean, format?: (value: number) => string): string {
  const target = enabled && format ? parseFigure(value) : null
  const [displayed, setDisplayed] = useState<string>(value)
  const fromRef = useRef<number | null>(target)
  const firstRender = useRef(true)

  useEffect(() => {
    if (target === null || !format) {
      setDisplayed(value)
      return
    }

    if (firstRender.current) {
      firstRender.current = false
      fromRef.current = target
      setDisplayed(value)
      return
    }

    const from = fromRef.current ?? target
    const delta = target - from
    if (delta === 0) {
      setDisplayed(value)
      return
    }

    const start = Date.now()
    let frame: number

    const tick = () => {
      const t = Math.min((Date.now() - start) / 650, 1)
      // Cubic ease-out, matching Ease.out closely enough that the count-up
      // settles on the same beat as the surrounding transitions.
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(format(from + delta * eased))
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
        setDisplayed(value)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, value, format])

  return displayed
}

/** Pulls a number back out of a formatted figure, or null if there isn't one. */
function parseFigure(text: string): number | null {
  const digits = text.replace(/[^0-9.\-]/g, '')
  if (!digits) return null
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : null
}

const styles = StyleSheet.create({
  base: {
    // Tabular figures, for two reasons that both matter here. A column of
    // amounts aligns on its digits rather than drifting by the width of a 1,
    // and a counting figure keeps a fixed width as it tweens instead of
    // twitching sideways on every frame.
    fontVariant: ['tabular-nums'],
    // A geometric sans at 34 or 46px sets a little loose for a number that
    // should read as one object. Small and negative, not enough to touch the
    // Indian grouping commas.
    letterSpacing: -0.2,
  },
})
