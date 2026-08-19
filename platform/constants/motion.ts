// Motion tokens. The single source for every duration, easing and spring.
//
// The system prescribes "200ms ease-out for sheets/modals, 150ms for
// taps (scale to 0.97)". Until now that was prose with no implementation;
// these are the values every animated component pulls from so the whole app
// moves at one tempo instead of each screen inventing its own timing.
//
// Rule of thumb for picking between a timing and a spring:
//   - Timing  → things that appear/disappear (opacity, sheets, skeletons).
//               Predictable duration, no overshoot.
//   - Spring  → things the finger is directly manipulating (press scale,
//               drag-to-dismiss, toggles). Overshoot reads as physical.

import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated'

export const Duration = {
  /** Colour/opacity swaps that should feel instantaneous. */
  instant: 100,
  /** Tap feedback. */
  fast: 150,
  /** The default. Sheets, modals, most entrances. */
  base: 200,
  /** Larger surfaces travelling further (full-screen sheets, hero content). */
  slow: 300,
  /** Deliberately noticeable: count-ups, progress fills, celebration beats. */
  slower: 450,
} as const

// Ease-out for anything entering (fast start, gentle settle, which feels
// responsive to a tap). Ease-in for anything leaving (the reverse). Standard
// for two-way moves. These match the curves iOS uses natively, which is why
// the app reads as "native" rather than "web page in an app".
export const Ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Linear: only for continuous loops (shimmer, spinners). */
  linear: Easing.linear,
} as const

export const Timing = {
  enter: { duration: Duration.base, easing: Ease.out } satisfies WithTimingConfig,
  exit: { duration: Duration.fast, easing: Ease.in } satisfies WithTimingConfig,
  fast: { duration: Duration.fast, easing: Ease.out } satisfies WithTimingConfig,
  base: { duration: Duration.base, easing: Ease.out } satisfies WithTimingConfig,
  slow: { duration: Duration.slow, easing: Ease.out } satisfies WithTimingConfig,
} as const

// `dampingRatio` + `duration` is Reanimated 3+/4's perceptual spring API: it
// describes the *result* (how bouncy, how long until it settles) instead of
// mass/stiffness/damping, so these stay legible and are safe to tune.
// dampingRatio 1 = critically damped (no overshoot), < 1 = overshoots.
export const Spring = {
  /** Press feedback and toggles. Quick, no wobble. */
  snappy: { dampingRatio: 1, duration: 250 } satisfies WithSpringConfig,
  /** Sheets and drag-release. A touch of overshoot reads as physical. */
  gentle: { dampingRatio: 0.85, duration: 400 } satisfies WithSpringConfig,
  /** Deliberate personality: success states, the stage timeline advancing. */
  bouncy: { dampingRatio: 0.6, duration: 550 } satisfies WithSpringConfig,
} as const

/** Scale a pressable settles to while held. */
export const PRESS_SCALE = 0.97

/**
 * Per-item delay for staggered list entrances. Capped by the caller after a
 * handful of rows: an 80-row list must not make row 80 wait 2.4 seconds, and
 * past ~8 items the eye stops reading it as a sequence anyway.
 */
export const STAGGER_MS = 30
export const STAGGER_MAX_ITEMS = 8

/** Delay for item `index`, flattened past `STAGGER_MAX_ITEMS`. */
export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER_MAX_ITEMS) * STAGGER_MS
}
