// Rate card themes (PRODUCT.md §8.11).
//
// A travel creator and a fashion creator are selling different things, and a
// card that looks the same for both looks like a form. The theme is suggested
// from her niche and changed with a picker; the choice persists on the profile
// (`card_theme`), because it is a preference rather than one of the per-share
// edits.
//
// ── Why gradients and not photographs ───────────────────────────────────────
//
// Every theme here is CSS. The card is rendered to a document and printed as
// often as it is viewed, so a bundled JPEG would either bloat the app or ship
// at a resolution that goes soft on an A5 page. Gradients and geometry stay
// sharp at any size, add nothing to the bundle, and cannot fail to load.
//
// The creator's own photograph is the image on the card. That is the one that
// should be photographic, and it is hers.

export interface GradientStops {
  colors: string[]
  /** 0–1, one per colour. */
  locations: number[]
}

export interface CardTheme {
  key: string
  /** Shown in the picker. */
  label: string
  /** Niches this is offered for first. Matched case-insensitively, as a substring. */
  niches: string[]
  /**
   * Front panel stops. One definition, two renderers: `cssStops()` turns it
   * into the gradient the card document uses, and the in-app preview feeds the
   * same arrays straight to expo-linear-gradient. A CSS string alone would
   * have to be parsed back apart for the preview, and the two would drift.
   */
  front: GradientStops
  /** Back panel. Deliberately quieter — it carries a table of numbers. */
  back: GradientStops
  /** Text on both panels. Every theme is designed for light text. */
  ink: string
  /** Secondary text, and hairlines. */
  inkSoft: string
  /**
   * A repeating background drawn over the gradient, as a CSS value.
   * Kept faint: it is texture, not decoration, and it sits under a rate table.
   */
  motif: string
}

/** Faint diagonal rules — the default texture, used where a theme wants none of its own. */
const RULES =
  'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 14px)'
/** Concentric arcs, for themes that want movement. */
const ARCS =
  'radial-gradient(120% 90% at 88% 6%, rgba(255,255,255,0.16) 0%, transparent 46%)'
/** A soft top-light, for themes that want depth rather than pattern. */
const GLOW =
  'radial-gradient(90% 60% at 20% 0%, rgba(255,255,255,0.20) 0%, transparent 60%)'

/** The stops as a CSS gradient body: `#fff 0%, #000 100%`. */
export function cssStops(stops: GradientStops): string {
  return stops.colors
    .map((colour, i) => `${colour} ${Math.round((stops.locations[i] ?? 0) * 100)}%`)
    .join(', ')
}

export const CARD_THEMES: CardTheme[] = [
  {
    key: 'signal',
    label: 'Signal',
    niches: ['tech', 'gadget', 'finance', 'business', 'education'],
    front: { colors: ['#5E97FF', '#1D46E8', '#4340D4', '#A99BEE'], locations: [0.0, 0.34, 0.62, 1.0] },
    back: { colors: ['#2A2A31', '#17171C', '#0E0E12', '#1A1A21'], locations: [0.0, 0.38, 0.72, 1.0] },
    ink: '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.62)',
    motif: RULES,
  },
  {
    key: 'horizon',
    label: 'Horizon',
    niches: ['travel', 'adventure', 'vlog', 'outdoor'],
    front: { colors: ['#FF9A5A', '#F4623A', '#B02E5A', '#3B1E63'], locations: [0.0, 0.3, 0.66, 1.0] },
    back: { colors: ['#241436', '#170D24', '#0D0716', '#1C1030'], locations: [0.0, 0.4, 0.74, 1.0] },
    ink: '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.66)',
    motif: ARCS,
  },
  {
    key: 'atelier',
    label: 'Atelier',
    niches: ['fashion', 'style', 'luxury', 'model'],
    front: { colors: ['#1A1A1A', '#2E2A2C', '#6B5560', '#C9A98F'], locations: [0.0, 0.38, 0.7, 1.0] },
    back: { colors: ['#141213', '#0E0D0E', '#171516', '#221E20'], locations: [0.0, 0.44, 0.78, 1.0] },
    ink: '#F6F1EC',
    inkSoft: 'rgba(246,241,236,0.58)',
    motif: GLOW,
  },
  {
    key: 'harvest',
    label: 'Harvest',
    niches: ['food', 'cook', 'chef', 'recipe', 'restaurant'],
    front: { colors: ['#F7B733', '#E2703A', '#A63A2E', '#4C1D1B'], locations: [0.0, 0.34, 0.68, 1.0] },
    back: { colors: ['#2A1512', '#1B0E0C', '#120908', '#241310'], locations: [0.0, 0.42, 0.76, 1.0] },
    ink: '#FFF8EE',
    inkSoft: 'rgba(255,248,238,0.62)',
    motif: RULES,
  },
  {
    key: 'bloom',
    label: 'Bloom',
    niches: ['beauty', 'skincare', 'makeup', 'wellness'],
    front: { colors: ['#FFC2D1', '#F58FB0', '#C05C8E', '#5E2A57'], locations: [0.0, 0.32, 0.66, 1.0] },
    back: { colors: ['#2A1226', '#1C0B1A', '#120711', '#241020'], locations: [0.0, 0.44, 0.78, 1.0] },
    ink: '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.66)',
    motif: GLOW,
  },
  {
    key: 'kinetic',
    label: 'Kinetic',
    niches: ['fitness', 'sport', 'gym', 'health', 'athlete'],
    front: { colors: ['#7DF2A8', '#17B978', '#0B6E58', '#07242E'], locations: [0.0, 0.32, 0.66, 1.0] },
    back: { colors: ['#0B1F1C', '#071412', '#040D0C', '#0C221E'], locations: [0.0, 0.42, 0.76, 1.0] },
    ink: '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.62)',
    motif: ARCS,
  },
  {
    key: 'daylight',
    label: 'Daylight',
    niches: ['lifestyle', 'family', 'home', 'parent', 'daily'],
    front: { colors: ['#FFD9A0', '#E9A6A6', '#9A7BC8', '#3E3A7A'], locations: [0.0, 0.34, 0.68, 1.0] },
    back: { colors: ['#221E3A', '#161327', '#0E0C1A', '#1D1935'], locations: [0.0, 0.44, 0.78, 1.0] },
    ink: '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.64)',
    motif: GLOW,
  },
]

export const DEFAULT_CARD_THEME = CARD_THEMES[0]

/**
 * The theme a creator gets before she picks one.
 *
 * Substring matching rather than an exact list, because `niche` is free text
 * she typed: "travel & food", "fashion / lifestyle" and "Tech reviews" all have
 * to land somewhere sensible. First match wins, which makes the order of
 * `niches` within a theme the tie-breaker.
 */
export function suggestTheme(niche: string | null | undefined): CardTheme {
  if (!niche) return DEFAULT_CARD_THEME
  const haystack = niche.toLowerCase()

  for (const theme of CARD_THEMES) {
    if (theme.niches.some((n) => haystack.includes(n))) return theme
  }
  return DEFAULT_CARD_THEME
}

/** The stored choice, falling back to the suggestion. */
export function resolveTheme(
  stored: string | null | undefined,
  niche: string | null | undefined
): CardTheme {
  const chosen = stored ? CARD_THEMES.find((t) => t.key === stored) : undefined
  return chosen ?? suggestTheme(niche)
}
