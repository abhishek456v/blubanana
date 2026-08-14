import { useEffect, useRef, useState } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'

export interface AnimatedNumberProps {
  value: number
  /** Renders the tweened value. Defaults to a plain rounded integer. */
  format?: (value: number) => string
  duration?: number
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}

/**
 * Counts up to `value` when it changes.
 *
 * Deliberately driven from JS rather than Reanimated. Animating text content
 * on the UI thread means the `useAnimatedProps` + `TextInput.text` trick,
 * which react-native-web does not implement — and these are a handful of stat
 * tiles on two screens, not a scroll-linked effect, so one rAF loop per tile
 * costs nothing and behaves identically on all three platforms.
 *
 * Tweening starts from the previously displayed number, so a dashboard
 * refreshing ₹40,000 → ₹52,000 counts the delta rather than restarting at
 * zero. First paint is not animated: landing on a screen where every figure
 * is spinning up from zero reads as a slot machine, not as data.
 */
export function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
  duration = 650,
  style,
  numberOfLines,
}: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(value)
  const fromRef = useRef(value)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      fromRef.current = value
      setDisplayed(value)
      return
    }

    const from = fromRef.current
    const delta = value - from
    if (delta === 0) return

    const start = Date.now()
    let frame: number

    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1)
      // Cubic ease-out — matches Ease.out's character closely enough that the
      // count-up settles on the same beat as the surrounding transitions.
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(from + delta * eased)

      if (t < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {format(displayed)}
    </Text>
  )
}
