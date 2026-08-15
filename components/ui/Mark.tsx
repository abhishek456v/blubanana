import Svg, { Path } from 'react-native-svg'
import { Colors } from '@/constants/design'

export interface MarkProps {
  size?: number
  color?: string
}

/**
 * The CreatorDesk mark: an open ring, cut on the right.
 *
 * Reads as a C, but the opening is the point: this is a product about a
 * business loop that does not close on its own.
 *
 * The single source of truth for the mark inside the app. The same geometry is
 * generated as PNGs by `scripts/generate-icons.mjs` (app icon, splash,
 * favicon) and inlined into the invoice PDF by `lib/invoiceHtml.ts`. Those
 * three are separate implementations because they render in three environments
 * that share no runtime, but they draw the same arc, from the same numbers,
 * and if one changes the others must too.
 */
export function Mark({ size = 24, color = Colors.light.accent }: MarkProps) {
  const centre = size / 2
  const radius = size / 2 - size * 0.11
  // 80° gap centred on the right: the arc runs from +40° to −40° the long way.
  const gap = (40 * Math.PI) / 180
  const x = centre + radius * Math.cos(gap)
  const yTop = centre - radius * Math.sin(gap)
  const yBottom = centre + radius * Math.sin(gap)

  return (
    <Svg width={size} height={size}>
      <Path
        d={`M ${x} ${yTop} A ${radius} ${radius} 0 1 0 ${x} ${yBottom}`}
        stroke={color}
        strokeWidth={size * 0.16}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  )
}
