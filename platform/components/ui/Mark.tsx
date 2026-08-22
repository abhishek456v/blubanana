import Svg, { Path } from 'react-native-svg'
import { Colors } from '@/constants/design'

export interface MarkProps {
  size?: number
  color?: string
}

/**
 * The Blubanana mark: a banana, in royal blue.
 *
 * It replaces an open ring that read as a C, drawn when the product was called
 * an earlier name and left behind by the rename. A wordmark reading "blubanana"
 * beside a C is a mark working against its own name.
 *
 * Two arcs sharing their endpoints. The inner arc has the *larger* radius, so
 * it is the flatter of the two and the blade is thick through the middle and
 * tapers to the tips. That second radius is the whole difference between a
 * banana and a crescent moon: with both radii equal, this is a moon.
 *
 * Geometry rather than a letter, deliberately. Text in an SVG depends on the
 * fonts of whatever machine rasterises it, so a lettered mark renders
 * differently on another laptop or in CI. Two arcs are two arcs everywhere.
 *
 * The stroke is the same colour as the fill and exists only for its round
 * join, which blunts what would otherwise be needle tips. Blunt tips survive a
 * 16px favicon; needle points turn to dust.
 *
 * The single source of truth for the mark inside the app. The same numbers are
 * rasterised to PNGs by `scripts/generate-icons.mjs` (app icon, splash,
 * favicon), inlined into the invoice PDF by `lib/invoiceHtml.ts`, and drawn
 * for the website favicon in `website/build.mjs`. Those four are separate
 * implementations because they render in four environments that share no
 * runtime, but they draw one shape from one set of numbers, and if any
 * constant here changes, all four must.
 */

/** Distance between the two tips, in the 100-unit space the path is drawn in. */
const CHORD = 84
/** How far the outer edge bows off the line joining the tips. */
const OUTER_RISE = 32
/** The same for the inner edge. The difference between them is the thickness. */
const INNER_RISE = 16
/** Blunts the cusps. Same colour as the fill; a join, not an outline. */
const BLUNT = 8

/**
 * The tilt, already applied to the endpoints below.
 *
 * A circular arc is rotation-invariant: turning it moves the endpoints and
 * leaves the radii and the flags alone. So the banana lies diagonally, the way
 * a banana sits rather than as a smile, without a transform anywhere. That
 * matters beyond tidiness — react-native-svg's rotation props emit a
 * `transform-origin` attribute that React rejects on the web build, so the
 * transform version logged a DOM warning on every render.
 */
const TILT_DEGREES = -40

/**
 * The tilted shape's bounding box, used as the viewBox.
 *
 * Measured by sampling both arcs and taking the extremes, not guessed. The
 * banana is drawn low and to one side of its own 100-unit box and the tilt
 * moves it further, so a plain `0 0 100 100` viewBox parked it in the
 * bottom-right corner of every icon. Recompute if the constants above change.
 */
const VIEW_BOX = '21.54 28.2 76.3 69.7'

/** Radius of a circular arc spanning `chord` and rising `rise` off it. */
function radiusFor(chord: number, rise: number): number {
  return ((chord * chord) / 4 + rise * rise) / (2 * rise)
}

function tilt(x: number, y: number): [number, number] {
  const radians = (TILT_DEGREES * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return [
    50 + (x - 50) * cos - (y - 50) * sin,
    50 + (x - 50) * sin + (y - 50) * cos,
  ]
}

/** The mark as an SVG path string, tilt included. */
export function markPath(): string {
  const [x0, y0] = tilt(50 - CHORD / 2, 62)
  const [x1, y1] = tilt(50 + CHORD / 2, 62)
  const outer = radiusFor(CHORD, OUTER_RISE).toFixed(2)
  const inner = radiusFor(CHORD, INNER_RISE).toFixed(2)
  const p = (n: number) => n.toFixed(2)
  return [
    `M ${p(x0)} ${p(y0)}`,
    `A ${outer} ${outer} 0 0 0 ${p(x1)} ${p(y1)}`,
    `A ${inner} ${inner} 0 0 1 ${p(x0)} ${p(y0)}`,
    'Z',
  ].join(' ')
}

export function Mark({ size = 24, color = Colors.light.accent }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX}>
      <Path
        d={markPath()}
        fill={color}
        stroke={color}
        strokeWidth={BLUNT}
        strokeLinejoin="round"
      />
    </Svg>
  )
}
