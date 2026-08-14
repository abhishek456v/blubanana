import { useWindowDimensions } from 'react-native'
import { Breakpoints } from '@/constants/design'

export type Tier = 'mobile' | 'wide' | 'desktop'

export interface Breakpoint {
  tier: Tier
  width: number
  /** Sidebar instead of bottom tabs, modal sheets instead of pushes. */
  isWide: boolean
  /** Enough room to lay content out in columns rather than one stack. */
  isDesktop: boolean
  /** Columns a metric grid should use at this width. */
  metricColumns: number
}

/**
 * The screen tier, and the couple of layout decisions that follow from it.
 *
 * Replaces a bare `isWide` boolean, which forced a 1440px laptop and a 768px
 * tablet down the same path — a single narrow column with the rest of the
 * window left empty.
 *
 * `metricColumns` lives here rather than in each screen because four screens
 * render a metric row and they were all deciding independently, which is how
 * they drifted apart.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions()

  const isDesktop = width >= Breakpoints.desktop
  const isWide = width >= Breakpoints.wide

  return {
    tier: isDesktop ? 'desktop' : isWide ? 'wide' : 'mobile',
    width,
    isWide,
    isDesktop,
    // Two on a phone keeps each tile readable; four on desktop turns the row
    // into a dashboard strip rather than two enormous cards with a void beside
    // them.
    metricColumns: isDesktop ? 4 : 2,
  }
}
