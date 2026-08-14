import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { Duration, Ease } from '@/constants/motion'

/**
 * How far above the bottom edge content starts revealing. Without this a card
 * only animates once it is already fully visible, which reads as late.
 */
const TRIGGER_INSET = 80

interface RevealScrollContext {
  /** Current scroll offset, updated as the user scrolls. */
  offset: number
  /** Height of the visible scroll area. */
  viewport: number
  /** False until the first scroll event, so first paint is not gated. */
  ready: boolean
}

const Ctx = createContext<RevealScrollContext | null>(null)

/**
 * A ScrollView that lets `Reveal` children know where the fold is.
 *
 * Drop-in replacement: same props, plus it publishes scroll offset and
 * viewport height on context.
 */
export function RevealScrollView({ children, onScroll, ...rest }: ScrollViewProps) {
  const { height: windowHeight } = useWindowDimensions()
  const [state, setState] = useState<RevealScrollContext>({
    offset: 0,
    viewport: windowHeight,
    ready: false,
  })

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = e.nativeEvent
    setState({ offset: contentOffset.y, viewport: layoutMeasurement.height, ready: true })
    onScroll?.(e)
  }

  return (
    <Ctx.Provider value={state}>
      <ScrollView {...rest} onScroll={handleScroll} scrollEventThrottle={32}>
        {children}
      </ScrollView>
    </Ctx.Provider>
  )
}

export interface RevealProps {
  children: ReactNode
  /**
   * How far the content travels up as it appears. Small on purpose: a long
   * slide draws attention to the animation rather than the content.
   */
  distance?: number
  /** Stagger, in ms, for a run of siblings. */
  delay?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Reveals its children once, as they come into view.
 *
 * Screens already stagger their first screenful with `entering` animations,
 * but in a ScrollView every child mounts immediately — so everything below the
 * fold had finished animating before the creator ever scrolled to it, and the
 * lower half of every screen simply existed rather than arriving.
 *
 * Fires once and stays put. Content that re-animates each time it crosses the
 * fold turns scrolling back up into a light show and makes a long screen feel
 * unstable.
 *
 * Outside a `RevealScrollView` it degrades to a plain mount animation, so it
 * is always safe to use.
 */
export function Reveal({ children, distance = 14, delay = 0, style }: RevealProps) {
  const scroll = useContext(Ctx)
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(distance)
  const [shown, setShown] = useState(false)
  const [top, setTop] = useState<number | null>(null)

  const reveal = () => {
    if (shown) return
    setShown(true)
    opacity.value = withDelay(delay, withTiming(1, { duration: Duration.slow, easing: Ease.out }))
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: Duration.slow, easing: Ease.out })
    )
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y
    setTop(y)
    // No scroll context, or the element already sits inside the first
    // screenful: reveal straight away rather than waiting for a scroll that
    // may never come.
    if (!scroll || y < scroll.viewport - TRIGGER_INSET) reveal()
  }

  // Crossed the fold on a later scroll.
  if (scroll && !shown && top != null && top < scroll.offset + scroll.viewport - TRIGGER_INSET) {
    reveal()
  }

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <View onLayout={onLayout} style={style}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </View>
  )
}
