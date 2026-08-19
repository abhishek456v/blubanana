import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useEffect } from 'react'
import { Colors, Elevation, FontFamily, Radius, Spacing } from '@/constants/design'
import { Spring } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from '@/components/ui'
import { TAB_BY_NAME } from './tabs'

const DOCK_HEIGHT = 64
const PILL = 46

/**
 * The floating dock that replaces the bottom tab bar on phones.
 *
 * A white pill on a near-black page, rather than a bar welded to the bottom
 * edge. The point is that the app's ground runs to the bottom of the display
 * and the navigation sits *on* it: a full-width bar with a hairline above it
 * cuts the page short and turns the last 80px into chrome.
 *
 * Labels are gone. Five icons in a 46px disc each is legible at a glance, and
 * the labels were the only thing forcing the bar tall enough to need that
 * hairline in the first place. The active destination is named by the screen's
 * own title, which is on screen directly above.
 *
 * The dock renders inside a transparent spacer in normal flow rather than
 * absolutely positioned. React Navigation measures whatever the `tabBar` prop
 * renders and insets every scene by that height; positioning it absolutely
 * reports a height of zero and puts the last row of every list underneath it.
 */
export function TabDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.spacer, { paddingBottom: insets.bottom + Spacing.base }]}>
      <View
        style={[
          styles.dock,
          // Always the light surface, in both themes. It is the one element
          // borrowed wholesale from the gradient cards' vocabulary: the white
          // disc that says "this is the control".
          { backgroundColor: Colors.dark.bgContrast },
          isDark ? Elevation.dark.lg : Elevation.light.lg,
        ]}
      >
        {state.routes.map((route, index) => {
          const spec = TAB_BY_NAME[route.name]
          if (!spec) return null

          const focused = state.index === index
          const { options } = descriptors[route.key]
          const badge = options.tabBarBadge

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
  const lift = useSharedValue(focused ? 1 : 0)

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, Spring.snappy)
  }, [focused, lift])

  // The disc scales in behind the glyph rather than appearing at full size, so
  // switching tabs reads as the indicator travelling to the new one.
  const discStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [{ scale: 0.6 + lift.value * 0.4 }],
  }))

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.item}
    >
      <Animated.View
        style={[styles.disc, { backgroundColor: Colors.dark.accent }, discStyle]}
        pointerEvents="none"
      />
      <Ionicons
        name={icon}
        size={22}
        // On the white dock the inactive glyph is the page ink at partial
        // strength; the active one goes white because it now sits on the blue
        // disc, not on the dock.
        color={focused ? '#FFFFFF' : 'rgba(11,11,18,0.45)'}
      />
      {badge != null ? (
        <View style={[styles.badge, { backgroundColor: Colors.dark.danger }]}>
          <Text style={styles.badgeText} allowFontScaling={false}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  spacer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: 'transparent',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: DOCK_HEIGHT,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
  },
  item: {
    flex: 1,
    height: PILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    ...StyleSheet.absoluteFillObject,
    // Inset so the disc is a circle inside the row's touch target rather than
    // a full-width lozenge.
    left: '50%',
    marginLeft: -PILL / 2,
    width: PILL,
    right: undefined,
    borderRadius: Radius.full,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: '50%',
    marginRight: -20,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
})
