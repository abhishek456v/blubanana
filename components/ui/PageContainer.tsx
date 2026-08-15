import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { ContentMaxWidth, DesktopContentMaxWidth, Spacing } from '@/constants/design'
import { useBreakpoint } from '@/hooks/useBreakpoint'

export interface PageContainerProps {
  children: ReactNode
  /**
   * `stack`:  one column, capped for reading length. Forms, detail screens.
   * `spread`: widens on desktop so content can lay out in columns. Dashboards.
   */
  width?: 'stack' | 'spread'
  style?: StyleProp<ViewStyle>
}

/**
 * The one place that decides how wide a page's content is.
 *
 * Every screen previously carried its own `contentWide` style: the same
 * `maxWidth: 720, alignSelf: 'center'` pasted eighteen times. That is why a
 * desktop window showed a narrow column marooned in the middle: the cap was
 * tuned for reading line length and then applied to dashboards, which are not
 * prose and do not want it.
 *
 * `spread` pages get a much wider cap on desktop so a metric row and a
 * two-column body have room to be laid out side by side instead of stacked.
 */
export function PageContainer({ children, width = 'stack', style }: PageContainerProps) {
  const { isDesktop } = useBreakpoint()

  const maxWidth =
    width === 'spread' && isDesktop ? DesktopContentMaxWidth : ContentMaxWidth

  return <View style={[styles.container, { maxWidth }, style]}>{children}</View>
}

/**
 * Style-object form, for the `contentContainerStyle` of a FlatList or
 * ScrollView where a wrapping View would break scrolling.
 */
export function pageWidthStyle(width: 'stack' | 'spread', isDesktop: boolean): ViewStyle {
  return {
    maxWidth: width === 'spread' && isDesktop ? DesktopContentMaxWidth : ContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  }
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
  },
})
