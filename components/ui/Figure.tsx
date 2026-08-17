import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native'
import { FigureSize, FontFamily } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'

/**
 * The characters Doto actually contains.
 *
 * Doto is a Latin dot-matrix face with no rupee sign (verified against its
 * cmap: U+20B9 is absent, and so is U+20A8). A missing glyph does not fail
 * loudly, it falls back per-character to whatever the platform picks, so
 * `₹3,75,000` would render its symbol in one arbitrary face and its digits in
 * another, differently on web and on device.
 *
 * Rather than leave that to chance, everything outside this set is set
 * deliberately in the sans. That turns the constraint into the rule the system
 * wants anyway: the digits are the instrument readout, and the symbol, the
 * unit and the month name are words attached to it.
 */
const DOT_SAFE = /[0-9.,:%+\-/()$ ]/

export interface FigureRun {
  text: string
  dotted: boolean
}

/**
 * Splits a formatted figure into alternating dot-matrix and sans runs.
 *
 * Exported for tests and for callers that need to measure a figure before
 * rendering it.
 */
export function splitFigureRuns(text: string): FigureRun[] {
  const runs: FigureRun[] = []
  for (const char of text) {
    const dotted = DOT_SAFE.test(char)
    const last = runs[runs.length - 1]
    if (last && last.dotted === dotted) last.text += char
    else runs.push({ text: char, dotted })
  }
  return runs
}

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
 * A number, set in the dot-matrix face.
 *
 * The split between Doto for figures and Outfit for words is the identity of
 * this design system, so this component is the only correct way to render an
 * amount, a count or a percentage. Setting `fontFamily: FontFamily.figure` by
 * hand skips the glyph-coverage handling above and produces a broken rupee
 * sign.
 *
 * The sans runs are set at 0.72 of the figure size rather than matching it.
 * A rupee sign at full size next to dot-matrix digits out-weighs them, because
 * a solid glyph carries roughly half again the visual mass of a dotted one at
 * equal height; a little under three-quarters is where the symbol stops
 * competing with the number it belongs to without shrinking into a superscript.
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
  const runs = splitFigureRuns(displayed)

  return (
    <Text
      style={[
        styles.base,
        { fontSize, color: resolved, fontFamily: bold ? FontFamily.figureBold : FontFamily.figure },
        style,
      ]}
      numberOfLines={numberOfLines}
      // The dotted glyphs are decorative to a screen reader, which reads the
      // string either way; but a caller that formats "3.8L" wants "3.8 lakh"
      // announced instead.
      accessibilityLabel={accessibilityLabel ?? value}
    >
      {runs.map((run, index) =>
        run.dotted ? (
          run.text
        ) : (
          <Text
            key={index}
            style={{
              fontFamily: FontFamily.medium,
              fontSize: Math.round(fontSize * 0.72),
            }}
          >
            {run.text}
          </Text>
        )
      )}
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
    // Dot-matrix glyphs sit on a wide advance width already, so this is small.
    // At zero the commas in an Indian-grouped amount crowd the digit before
    // them and `3,75,000` reads as one run.
    letterSpacing: 0.4,
  },
})
