import { Platform } from 'react-native'

// Design tokens. Always pull from here, never hardcode values.
//
// The system is a dark, gradient-glass identity: a near-black ground with a
// faint blue cast, large squircle cards carrying full-bleed gradients that
// light themselves, and every *number* set in a dot-matrix face while every
// *word* is set in a geometric sans. The contrast between those two type
// systems is the identity; it is not decoration, and it is why a figure reads
// as an instrument panel readout rather than as body copy that happens to be
// large.
//
// Light mode is a derivation, not an inversion. The cards are self-lit, so
// they carry across unchanged; only the ground and the type flip. Inverting
// the gradients would produce a different product.

// `bgContrast` is the white element that punches out of the dark: the floating
// dock, the circular action buttons, the active nav pill. On the light theme
// it inverts to near-black so the role survives.
//
// Sparingly. Its whole job is to be the one thing the eye lands on first,
// which stops being true the moment a screen has four of them.
export const Colors = {
  light: {
    // Cool, not warm. The neutrals carry a slight blue bias toward the accent
    // so they read as chosen rather than as an unconfigured grey.
    bgPage: '#EEEEF3',
    bgSurface: '#FFFFFF',
    bgSurfaceRaised: '#FFFFFF',
    bgContrast: '#0B0B12',
    onContrast: '#FFFFFF',
    onContrastMuted: 'rgba(255,255,255,0.62)',
    // Hairlines, ghost fills and chart tracks *on* the contrast surface. The
    // page's `border` token is derived from the page ground, so on an inverted
    // surface it is invisible in one theme and glaring in the other.
    onContrastFaint: 'rgba(255,255,255,0.16)',
    border: 'rgba(11,11,18,0.08)',
    borderStrong: 'rgba(11,11,18,0.16)',
    textPrimary: '#0B0B12',
    textSecondary: 'rgba(11,11,18,0.62)',
    textMuted: 'rgba(11,11,18,0.42)',
    fillPrimary: '#2B5CF0',
    onFillPrimary: '#FFFFFF',
    accent: '#2B5CF0',
    // The accent as *text*. On a light ground the fill blue is already legible,
    // so this deepens only slightly to clear AA at caption sizes.
    accentText: '#1E44C4',
    accentLight: 'rgba(43,92,240,0.10)',
    // Between `accentLight` (a tint you put text on) and `accent` (the thing
    // itself). Chart tracks need this: at 10% alpha a bar reads as a loading
    // skeleton rather than as data.
    accentSoft: 'rgba(43,92,240,0.42)',
    accentHover: '#1E44C4',
    success: '#0F7A4A',
    successLight: 'rgba(15,122,74,0.10)',
    warning: '#8A5200',
    warningLight: 'rgba(138,82,0,0.10)',
    danger: '#C22C4A',
    dangerLight: 'rgba(194,44,74,0.10)',
    info: '#1E44C4',
    infoLight: 'rgba(30,68,196,0.10)',
  },
  dark: {
    // Not pure black. A few points of blue in the ground is what lets the blue
    // and magenta cards sit *in* the page rather than on top of it; over
    // #000000 the same cards read as stickers.
    bgPage: '#08080C',
    bgSurface: '#141419',
    bgSurfaceRaised: '#1D1D23',
    bgContrast: '#FFFFFF',
    onContrast: '#0B0B12',
    onContrastMuted: 'rgba(11,11,18,0.60)',
    onContrastFaint: 'rgba(11,11,18,0.10)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.60)',
    textMuted: 'rgba(255,255,255,0.40)',
    fillPrimary: '#3B6EF6',
    onFillPrimary: '#FFFFFF',
    accent: '#3B6EF6',
    // On a near-black ground the fill blue clears AA on its own, so the text
    // variant lightens instead of darkening. The token exists so screens can
    // use one name in both themes.
    accentText: '#7FA5FF',
    accentLight: 'rgba(59,110,246,0.16)',
    // Higher alpha than the light theme's: a blue at 42% over near-black reads
    // as slate, not as blue.
    accentSoft: 'rgba(59,110,246,0.58)',
    accentHover: '#5E88FF',
    success: '#3DD68C',
    successLight: 'rgba(61,214,140,0.14)',
    warning: '#F5B544',
    warningLight: 'rgba(245,181,68,0.14)',
    danger: '#FF6B81',
    dangerLight: 'rgba(255,107,129,0.14)',
    info: '#7FA5FF',
    infoLight: 'rgba(127,165,255,0.14)',
  },
} as const

// ---------------------------------------------------------------------------
// Gradients
//
// The signature surface. Each is a four-stop diagonal rather than the usual
// two: the extra stops are what produce the darkened middle and the returning
// light at the far corner, and without them the card reads as a flat colour
// ramp. `locations` is deliberately uneven, so the dark band sits past the
// centre and the card looks lit from the top-left corner.
//
// `start`/`end` run corner to corner. An axis-aligned gradient loses the
// effect entirely.
// ---------------------------------------------------------------------------

export interface GradientSpec {
  readonly colors: readonly [string, string, ...string[]]
  readonly locations: readonly [number, number, ...number[]]
  readonly start: { readonly x: number; readonly y: number }
  readonly end: { readonly x: number; readonly y: number }
}

const diagonal = { start: { x: 0.05, y: 0 }, end: { x: 0.85, y: 1 } } as const

export const Gradients = {
  /** Money in, and anything owed to her. The primary card. */
  blue: {
    colors: ['#5E97FF', '#1D46E8', '#4340D4', '#A99BEE'],
    locations: [0, 0.34, 0.62, 1],
    ...diagonal,
  },
  /** Totals and balances. The second card, never on the same row as blue. */
  magenta: {
    colors: ['#E23A9C', '#A32483', '#5E1B5E', '#C42F6F'],
    locations: [0, 0.32, 0.66, 1],
    ...diagonal,
  },
  /** Neutral glass, for a card that must not compete with the two above. */
  ink: {
    colors: ['#2A2A31', '#17171C', '#0E0E12', '#1A1A21'],
    locations: [0, 0.38, 0.72, 1],
    ...diagonal,
  },
  /** Ambient wash painted behind the page on the dark theme. */
  aura: {
    colors: ['#1B1E4A', '#0C0C18', '#08080C'],
    locations: [0, 0.5, 1],
    start: { x: 0.8, y: 0 },
    end: { x: 0.1, y: 0.7 },
  },
} as const satisfies Record<string, GradientSpec>

export type GradientName = keyof typeof Gradients

/**
 * The hairline along a gradient card's top edge.
 *
 * A gradient card with a hard cut edge looks printed on. A single highlight at
 * the top, brighter than anything in the gradient underneath, is what reads as
 * a lit surface with a physical edge. It is one border-top, not a full border:
 * ringing the whole card outlines it instead of lighting it.
 */
export const CardRimLight = 'rgba(255,255,255,0.34)'

/** The frosted rim on `ink` cards, which have no bright stop of their own. */
export const CardRimInk = 'rgba(255,255,255,0.14)'

// Flat, hashed-by-name avatar background colors. Cool spectrum, tuned to sit
// on the near-black ground without any one of them jumping out of a list.
// Text on top is always white.
export const AvatarPalette = [
  '#3B6EF6', // blue (accent)
  '#7C5CF0', // violet
  '#E23A9C', // magenta
  '#2AA9C9', // cyan
  '#3DD68C', // green
  '#F5B544', // amber
  '#FF6B81', // rose
  '#8E7BEF', // periwinkle
] as const

// A 4-based scale with no gaps. `base` is the default gap between siblings.
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  base: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

// Everything is rounder in this system than in a conventional card UI, and the
// large end is very large: `card` at 36 against a ~320px card is the squircle
// that reads as the system's shape. Scaling only the top of the scale would
// leave chips and inputs looking sharp next to it, so the whole scale moved.
export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  /** The signature squircle. Gradient cards and nothing else. */
  card: 36,
  full: 999,
} as const

// Sizes only. Weight comes from `FontFamily`, never from `fontWeight`.
//
// Outfit ships as a separate file per weight, so the weight is already baked
// into the family name. Asking for `fontFamily: 'Outfit_400Regular'` and
// `fontWeight: '600'` together makes native look for a semibold cut of a family
// that has exactly one cut, fail, and silently fall back to the system face,
// which is why type looked consistent on web and mismatched on device.
export const Typography = {
  display: { fontSize: 32 },
  title: { fontSize: 22 },
  heading: { fontSize: 17 },
  body: { fontSize: 15 },
  bodyStrong: { fontSize: 15 },
  caption: { fontSize: 13 },
  label: { fontSize: 12 },
} as const

/**
 * Sizes for dot-matrix figures.
 *
 * Larger than the equivalent prose sizes, and deliberately so: a dot-matrix
 * glyph is mostly negative space, so it carries perhaps two-thirds the visual
 * weight of a solid glyph at the same point size. Setting a figure at `display`
 * makes it look smaller than the heading above it. Below roughly 20px the dots
 * merge and the face stops reading as dotted at all, which is the entire reason
 * it is here, so `sm` is the floor.
 */
export const FigureSize = {
  hero: 46,
  lg: 34,
  md: 26,
  sm: 20,
} as const

// Two families, and the split between them is the identity.
//
//   Outfit  every word: labels, headings, body, buttons.
//   Doto    every *display* figure: currency, counts, dates-as-numbers.
//
// Doto is a dot-matrix face, so it is never used for prose at any size. It has
// no italic, its punctuation is coarse, and a sentence set in it is unreadable.
// Use `figure` for the number and `regular` for the word beside it, even when
// they sit in the same line.
//
// The split is by *size*, not by "is it a number". Below roughly 20px the dots
// merge and the face stops reading as dotted at all, so it buys nothing and
// costs legibility — see `FigureSize.sm`, which is the floor. An amount set at
// body size inside a list row or a table cell therefore stays in Outfit, and
// that is correct rather than an omission: those are figures being read in a
// sentence, not figures being displayed. Anything at `FigureSize` goes through
// the `Figure` component, which also handles the rupee sign (see that file).
export const FontFamily = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semiBold: 'Outfit_600SemiBold',
  display: 'Outfit_600SemiBold',
  displayBold: 'Outfit_700Bold',
  /** Dot-matrix. Numerals only. */
  figure: 'Doto_500Medium',
  figureBold: 'Doto_700Bold',
} as const

// Below `wide`, the app uses the mobile layout (floating dock, edge-to-edge
// content). At or above it, a sidebar rail replaces the dock. 768 matches
// react-navigation's own tablet threshold, so the sidebar switch and the
// library's internal label-layout switch agree.
//
//   mobile  (<768)      floating dock, single column, edge-to-edge
//   wide    (768–1179)  icon rail appears, content still one column
//   desktop (>=1180)    content spreads: cards in a row, two-column body
export const Breakpoints = {
  wide: 768,
  desktop: 1180,
} as const

export const SidebarWidth = 240

/** Width of the collapsed icon rail on the dark theme's desktop layout. */
export const RailWidth = 72

// Caps how wide a single column of text or form inputs gets. Reading line
// length, not screen width, is what sets this.
export const ContentMaxWidth = 720

/** Cap for a desktop page that lays out in columns rather than one stack. */
export const DesktopContentMaxWidth = 1160

/** Gap between columns in a desktop two-column body. */
export const ColumnGap = 20

// Sign-in/sign-up have no sidebar to sit next to, so they get their own,
// narrower cap instead of ContentMaxWidth (which assumes a rail already ate
// its width from the window).
export const AuthFormMaxWidth = 400

// ---------------------------------------------------------------------------
// Elevation
//
// Two jobs, kept separate. `Elevation` establishes layer order in neutral
// black: what sits above what. `cardGlow` is the coloured light a gradient
// card casts onto the ground beneath it, which is an optical property of the
// card, not a statement about stacking. Using a neutral shadow under a
// saturated card is what makes it look pasted on.
// ---------------------------------------------------------------------------

/**
 * Two-layer shadows.
 *
 * A single tight shadow is what makes a card read as a sticker: the whole
 * shape darkens uniformly and the edge stays hard. Real depth is two
 * overlapping falloffs:
 *
 *   contact:  small, tight, barely visible. Anchors the element to the
 *             surface and keeps the bottom edge from floating.
 *   ambient:  large, wide, very faint. Does the actual lifting, and is the
 *             layer that reads as soft rather than dirty.
 *
 * Blur runs roughly 3x the offset on the ambient layer. Below about 2x the
 * shadow reads as a hard smudge.
 *
 * Dark mode needs far more opacity: a light surface on a dark ground separates
 * by luminance much less than the reverse.
 */
const layered = (
  contact: string,
  ambient: string,
  native: { color: string; opacity: number; radius: number; offsetY: number; elevation: number }
) =>
  Platform.select({
    // Web takes both layers. React Native Web maps boxShadow straight through,
    // so this is the full effect.
    web: { boxShadow: `${contact}, ${ambient}` } as object,
    // Native gets one shadow per view, so it takes the ambient layer (the one
    // doing the lifting), plus Android's elevation alongside it.
    default: {
      shadowColor: native.color,
      shadowOffset: { width: 0, height: native.offsetY },
      shadowOpacity: native.opacity,
      shadowRadius: native.radius,
      elevation: native.elevation,
    },
  }) as {
    boxShadow?: string
    shadowColor?: string
    shadowOffset?: { width: number; height: number }
    shadowOpacity?: number
    shadowRadius?: number
    elevation?: number
  }

export const Elevation = {
  light: {
    /** Raised rows and cards that lift off the page a little. */
    sm: layered(
      '0px 1px 2px rgba(11,11,30,0.04)',
      '0px 4px 14px rgba(11,11,30,0.07)',
      { color: '#0B0B1E', opacity: 0.07, radius: 14, offsetY: 4, elevation: 2 }
    ),
    /** Sheets, popovers, floating panels. */
    md: layered(
      '0px 2px 4px rgba(11,11,30,0.05)',
      '0px 12px 32px rgba(11,11,30,0.10)',
      { color: '#0B0B1E', opacity: 0.1, radius: 32, offsetY: 12, elevation: 8 }
    ),
    /** The one thing floating above everything (dock, toast). */
    lg: layered(
      '0px 4px 8px rgba(11,11,30,0.06)',
      '0px 24px 56px rgba(11,11,30,0.15)',
      { color: '#0B0B1E', opacity: 0.15, radius: 56, offsetY: 24, elevation: 16 }
    ),
  },
  dark: {
    sm: layered(
      '0px 1px 2px rgba(0,0,0,0.30)',
      '0px 4px 14px rgba(0,0,0,0.36)',
      { color: '#000000', opacity: 0.36, radius: 14, offsetY: 4, elevation: 2 }
    ),
    md: layered(
      '0px 2px 4px rgba(0,0,0,0.34)',
      '0px 12px 32px rgba(0,0,0,0.48)',
      { color: '#000000', opacity: 0.48, radius: 32, offsetY: 12, elevation: 8 }
    ),
    lg: layered(
      '0px 6px 12px rgba(0,0,0,0.40)',
      '0px 28px 64px rgba(0,0,0,0.62)',
      { color: '#000000', opacity: 0.62, radius: 64, offsetY: 28, elevation: 20 }
    ),
  },
} as const

/**
 * The coloured light a gradient card casts on the ground beneath it.
 *
 * Offset downward and blurred far wider than a drop shadow, because it is
 * modelling bounce rather than occlusion: the card is the light source. Pass
 * the hue the card is actually made of; a blue glow under the magenta card
 * reads as a rendering mistake rather than as depth.
 *
 * Native gets no coloured spread (one shadow per view, and it would fight the
 * elevation shadow), so it falls back to the same hue at lower opacity.
 */
export const cardGlow = (color: string, opacity = 0.34) =>
  Platform.select({
    web: {
      boxShadow: `0px 18px 48px -12px ${withAlpha(color, opacity)}, 0px 4px 12px -4px ${withAlpha(color, opacity * 0.5)}`,
    } as object,
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: opacity * 0.8,
      shadowRadius: 28,
      elevation: 12,
    },
  }) as object

/**
 * Hex to `rgba()` at a given alpha.
 *
 * Only handles the `#RRGGBB` form, which is every colour in this file that is
 * ever passed to it. Anything already carrying alpha is returned untouched
 * rather than mangled, so `cardGlow(c.accentSoft)` degrades to a no-op instead
 * of producing `rgba(NaN, ...)` and silently dropping the shadow.
 */
export function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#') || color.length !== 7) return color
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** The hue each gradient glows with. Keyed to `Gradients`. */
export const GradientGlow: Record<GradientName, string> = {
  blue: '#2B55E8',
  magenta: '#C42F8E',
  ink: '#000000',
  aura: '#1B1E4A',
}

/**
 * The soft accent glow on primary buttons.
 *
 * Not a drop shadow but a halo: no vertical offset, so the light reads as
 * coming *from* the button rather than falling beneath it. That is what makes
 * a filled button look lit instead of like a card sitting on the page.
 */
export const accentGlow = (opacity = 0.3) =>
  Platform.select({
    web: { boxShadow: `0px 6px 20px rgba(59,110,246,${opacity})` } as object,
    default: {
      shadowColor: Colors.dark.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: opacity,
      shadowRadius: 20,
      elevation: 0,
    },
  }) as object

/** Standard touch expansion for small icon-only controls (close, dismiss). */
export const HitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const
