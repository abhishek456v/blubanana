import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { FontFamily, Radius } from '@/constants/design'

export interface OrbitItem {
  id: string
  /** Drawn as initials. Two characters is the most that fits a chip. */
  label: string
}

export interface OrbitRingProps {
  /** The chip at the centre, inside the inner ring. */
  center?: OrbitItem | null
  /** Chips distributed clockwise around the outer ring, starting at the top. */
  items: readonly OrbitItem[]
  size?: number
  /** Chip diameter. The centre chip is drawn 1.25x this. */
  chip?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Concentric rings with brand chips sitting on them.
 *
 * What it encodes: the centre is the brand the card is about, and the ring
 * holds the others in play. It is a relationship diagram, not a chart, so it
 * carries no magnitude and must never be asked to; a screen that needs
 * amounts compared uses `DotGrid` or `BarChart` instead.
 *
 * The outer ring is dotted and the inner ring solid. Both are drawn in SVG
 * rather than as bordered Views because a dashed border in React Native is
 * unsupported on Android for rounded corners and renders as a solid ring
 * there, which quietly loses the distinction between the two rings.
 */
export function OrbitRing({ center, items, size = 190, chip = 34, style }: OrbitRingProps) {
  const radius = size / 2
  // Chips sit centred *on* the stroke, so the ring has to clear the chip's own
  // radius or the outer chips get clipped by the container.
  const outerR = radius - chip / 2
  const innerR = radius * 0.42

  const centerChip = Math.round(chip * 1.25)

  return (
    <View style={[{ width: size, height: size }, styles.root, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={radius}
          cy={radius}
          r={outerR}
          stroke="rgba(255,255,255,0.42)"
          strokeWidth={1.5}
          // Round caps on a 1.5px dash of near-zero length draw actual dots
          // rather than dashes.
          strokeLinecap="round"
          strokeDasharray="0.5 7"
          fill="none"
        />
        <Circle
          cx={radius}
          cy={radius}
          r={innerR}
          stroke="rgba(255,255,255,0.30)"
          strokeWidth={1}
          fill="none"
        />
      </Svg>

      {items.map((item, index) => {
        // Start at twelve o'clock and go clockwise. SVG/screen coordinates put
        // 0 radians at three o'clock with y growing downward, hence the
        // quarter-turn offset.
        const angle = (index / Math.max(items.length, 1)) * Math.PI * 2 - Math.PI / 2
        return (
          <Chip
            key={item.id}
            label={item.label}
            size={chip}
            style={{
              left: radius + Math.cos(angle) * outerR - chip / 2,
              top: radius + Math.sin(angle) * outerR - chip / 2,
            }}
          />
        )
      })}

      {center ? (
        <Chip
          label={center.label}
          size={centerChip}
          emphasis
          style={{ left: radius - centerChip / 2, top: radius - centerChip / 2 }}
        />
      ) : null}
    </View>
  )
}

function Chip({
  label,
  size,
  emphasis = false,
  style,
}: {
  label: string
  size: number
  emphasis?: boolean
  style: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: Radius.full,
          // The centre chip is opaque white and the ring chips are slightly
          // translucent, so the centre reads as nearest the viewer without
          // needing a size jump alone to carry it.
          backgroundColor: emphasis ? '#FFFFFF' : 'rgba(255,255,255,0.92)',
        },
        style,
      ]}
    >
      <Text
        style={[styles.chipText, { fontSize: Math.round(size * 0.36) }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    alignSelf: 'center',
  },
  chip: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: FontFamily.semiBold,
    color: '#0B0B12',
    // Two uppercase initials at chip size need the tracking opened slightly or
    // they touch.
    letterSpacing: 0.3,
  },
})
