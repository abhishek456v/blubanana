import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  CardRimInk,
  CardRimLight,
  FontFamily,
  GradientGlow,
  Gradients,
  Radius,
  Spacing,
  Typography,
  cardGlow,
  type GradientName,
} from '@/constants/design'
import { PressableScale } from './PressableScale'

export interface GradientCardProps {
  /**
   * Which of the three surfaces this is.
   *
   * `blue` and `magenta` are both loud, so never put them side by side on the
   * same row: two saturated cards competing means neither is the one the eye
   * lands on, which is the whole reason the hierarchy exists. `ink` is the
   * neutral third that lets a screen carry more than one gradient card.
   */
  gradient?: GradientName
  /** Sits top-left, in the sans. Never a figure. */
  title?: string
  /** Top-right affordance: a circular button, a period pill, a status chip. */
  action?: ReactNode
  children: ReactNode
  onPress?: () => void
  /** Trims the interior padding where the card is one of several in a row. */
  dense?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

/**
 * The signature surface: a large squircle carrying a four-stop diagonal
 * gradient that lights itself.
 *
 * Three things together make it read as a lit physical object rather than as a
 * coloured rectangle, and dropping any one of them collapses the effect:
 *
 *   the gradient   four stops, so there is a darkened band past the centre and
 *                  light returning at the far corner (see `Gradients`)
 *   the rim        a bright hairline along the top edge only, brighter than
 *                  anything in the gradient beneath it
 *   the glow       coloured light cast downward onto the page, in the card's
 *                  own hue
 *
 * The rim is drawn as an overlay rather than a border on the gradient itself
 * because `LinearGradient` clips its fill to the padding box: a border on it
 * leaves a hairline of page colour between fill and edge on web at
 * fractional device pixel ratios.
 */
export function GradientCard({
  gradient = 'blue',
  title,
  action,
  children,
  onPress,
  dense = false,
  style,
  accessibilityLabel,
}: GradientCardProps) {
  const spec = Gradients[gradient]
  const isInk = gradient === 'ink'

  const body = (
    <>
      <LinearGradient
        colors={spec.colors as unknown as readonly [string, string, ...string[]]}
        locations={spec.locations as unknown as readonly [number, number, ...number[]]}
        start={spec.start}
        end={spec.end}
        style={StyleSheet.absoluteFill}
      />

      {/* Bright at the top, faint around the rest. A uniform ring outlines the
          card; a top-only highlight lights it. */}
      <View
        pointerEvents="none"
        style={[
          styles.rim,
          {
            borderColor: isInk ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
            borderTopColor: isInk ? CardRimInk : CardRimLight,
          },
        ]}
      />

      {title || action ? (
        <View style={styles.header}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <View style={styles.spacer} />
          )}
          {action}
        </View>
      ) : null}

      {children}
    </>
  )

  const shell: StyleProp<ViewStyle> = [
    styles.card,
    dense ? styles.paddedDense : styles.padded,
    cardGlow(GradientGlow[gradient], isInk ? 0.5 : 0.34),
    style,
  ]

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        style={shell}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
      >
        {body}
      </PressableScale>
    )
  }

  return (
    <View style={shell} accessibilityLabel={accessibilityLabel}>
      {body}
    </View>
  )
}

export interface FigureBlockProps {
  /** The formatted amount or count. Rendered through `Figure` by the caller. */
  figure: ReactNode
  label: string
  /**
   * Puts the label above the figure.
   *
   * The card's bottom pair reads label-then-figure so that the two figures on
   * the card sit at its outer edges and the labels face each other inward.
   * Repeating figure-then-label at the bottom pushes both figures toward the
   * middle and the corners go empty.
   */
  reverse?: boolean
  align?: 'left' | 'right'
  labelColor?: string
  style?: StyleProp<ViewStyle>
}

/** A figure with its caption. The unit the gradient card's corners are built from. */
export function FigureBlock({
  figure,
  label,
  reverse = false,
  align = 'left',
  labelColor = 'rgba(255,255,255,0.62)',
  style,
}: FigureBlockProps) {
  const caption = (
    <Text style={[styles.blockLabel, { color: labelColor }]} numberOfLines={1}>
      {label}
    </Text>
  )

  return (
    <View style={[align === 'right' && styles.blockRight, style]}>
      {reverse ? caption : null}
      {figure}
      {reverse ? null : caption}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    // Clips the gradient to the squircle. Without it the fill paints square
    // corners underneath the rounded rim on Android.
    overflow: 'hidden',
    // Establishes the stacking context the absolutely-positioned gradient and
    // rim sit inside, so content after them paints on top without every child
    // needing a zIndex.
    position: 'relative',
  },
  padded: {
    padding: Spacing.lg,
  },
  paddedDense: {
    padding: Spacing.md,
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    // The circular action is 44px and the title is a single line, so the row
    // is action-height. Fixing it keeps cards in a row aligned even when one
    // has no action at all.
    minHeight: 44,
  },
  spacer: {
    flex: 1,
  },
  title: {
    flex: 1,
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
  blockRight: {
    alignItems: 'flex-end',
  },
  blockLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
})
