import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from '@/components/ui'
import { TAB_BY_NAME } from './tabs'

/**
 * The bottom tab bar on phones.
 *
 * Five labelled destinations, flush with the bottom of the display, on the
 * page ground with a hairline above it (20 Aug redesign, Phase 4; the user
 * supplied a reference bar built exactly this way).
 *
 * This replaced a floating white pill of unlabelled icon discs. Two things
 * were wrong with it: the labels were missing, so five glyphs had to be
 * decoded rather than read; and it floated in from the screen edges, which
 * left a strip of page visible underneath and put the bar's own rounded
 * corners between the content and the edge of the phone. The user asked for
 * it to touch the bottom, and it now does.
 *
 * The active item is named by weight and full-strength ink rather than by a
 * coloured disc behind the glyph. With a label present the disc was a second
 * indicator saying the same thing, and it was the thing forcing the row tall.
 *
 * Rendered inside a spacer in normal flow, not absolutely positioned. React
 * Navigation measures whatever `tabBar` renders and insets every scene by that
 * height; positioning it absolutely reports zero and puts the last row of
 * every list underneath it.
 */
export function TabDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.bgPage,
          borderTopColor: c.border,
          // The home indicator strip, so the labels clear it. Without the
          // fallback, a phone with no inset gets a bar with no bottom padding
          // at all and the labels sit on the very edge.
          paddingBottom: Math.max(insets.bottom, Spacing.sm),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const spec = TAB_BY_NAME[route.name]
        if (!spec) return null

        const focused = state.index === index
        const badge = descriptors[route.key].options.tabBarBadge

        return (
          <DockItem
            key={route.key}
            focused={focused}
            icon={focused ? spec.icon : spec.iconOutline}
            label={spec.title}
            badge={typeof badge === 'number' && badge > 0 ? badge : null}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              })
              // Respecting `preventDefault` is what keeps a tab able to
              // scroll-to-top instead of navigating when it is already
              // focused; the default bar does this and a custom one that
              // skips it silently breaks that behaviour.
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params)
              }
            }}
          />
        )
      })}
    </View>
  )
}

function DockItem({
  focused,
  icon,
  label,
  badge,
  onPress,
}: {
  focused: boolean
  icon: keyof typeof Ionicons.glyphMap
  label: string
  badge: number | null
  onPress: () => void
}) {
  const { c } = useTheme()
  const tint = focused ? c.textPrimary : c.textMuted

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.item}
    >
      <View>
        <Ionicons name={icon} size={22} color={tint} />
        {badge != null ? (
          <View style={[styles.badge, { backgroundColor: c.danger, borderColor: c.bgPage }]}>
            <Text style={styles.badgeText} allowFontScaling={false}>
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.label, { color: tint }, focused && styles.labelActive]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    // Keeps the whole column tappable rather than just the glyph, and holds
    // the 44px minimum with the label included.
    paddingVertical: 2,
  },
  label: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
    fontSize: 10.5,
  },
  labelActive: {
    fontFamily: FontFamily.semiBold,
  },
  badge: {
    position: 'absolute',
    top: -4,
    left: 12,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 9,
    color: '#FFFFFF',
  },
})
