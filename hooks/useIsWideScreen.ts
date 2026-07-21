import { useWindowDimensions } from 'react-native'
import { Breakpoints } from '@/constants/design'

// Drives the mobile bottom-tabs vs. desktop sidebar switch (DESIGN.md 4)
// and the content max-width applied on wide screens.
export function useIsWideScreen(): boolean {
  const { width } = useWindowDimensions()
  return width >= Breakpoints.wide
}
