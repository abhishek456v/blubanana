import { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import {
  Elevation,
  FontFamily,
  RailWidth,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { Spring } from '@/constants/motion'
import { useTheme } from '@/hooks/useTheme'
import { getProfile } from '@/lib/profile'
import { BrandAvatar } from '@/components/BrandAvatar'
import { Mark, PressableScale } from '@/components/ui'
import { TAB_BY_NAME } from './tabs'

const ITEM = 46

/**
 * The desktop navigation: a narrow rail of icon discs.
 *
 * Replaces a 240px labelled sidebar. Five destinations do not need 240px of
 * chrome on every screen, and the width was coming straight out of the content
 * measure — the widest thing in the app is a table of invoices, which is
 * exactly what was being squeezed.
 *
 * Icon-only navigation is a real discoverability cost, so it is paid for with
 * a hover label rather than left to the icon alone. On touch platforms there
 * is no hover, but there is also no rail: below `wide` this is replaced by the
 * dock, which is reached by thumb and equally unlabelled.
 */
export function SidebarRail({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c } = useTheme()
  const router = useRouter()
  const [creator, setCreator] = useState<{ name: string } | null>(null)

  // Fetched once for the lifetime of the rail rather than on focus: a name on
  // an avatar does not need to be live, and re-fetching on every tab change
  // would put a request behind every navigation.
  useEffect(() => {
    let active = true
    getProfile()
      .then((profile) => {
        if (active) setCreator({ name: profile.name })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const displayName = creator?.name?.trim() || 'Your desk'

  return (
    <View style={[styles.rail, { backgroundColor: c.bgPage, borderRightColor: c.border }]}>
      <View style={styles.brand}>
        <Mark size={26} color={c.accent} />
      </View>

      <View style={styles.nav}>
        {state.routes.map((route, index) => {
          const spec = TAB_BY_NAME[route.name]
          if (!spec) return null

          const focused = state.index === index
          const badge = descriptors[route.key].options.tabBarBadge

          return (
            <RailItem
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

      <PressableScale
        onPress={() => router.push('/(app)/(tabs)/settings' as never)}
        style={styles.footer}
        accessibilityRole="button"
        accessibilityLabel={`${displayName}, open your profile`}
      >
        <BrandAvatar name={displayName} size={34} />
      </PressableScale>
    </View>
  )
}

function RailItem({
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
  const [hovered, setHovered] = useState(false)
  const lift = useSharedValue(focused ? 1 : 0)

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, Spring.snappy)
  }, [focused, lift])

  // The disc scales in behind the glyph rather than appearing at full size, so
  // moving between destinations reads as the indicator travelling.
  const discStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
    transform: [{ scale: 0.6 + lift.value * 0.4 }],
  }))

  return (
    <View style={styles.itemRow}>
      <PressableScale
        onPress={onPress}
        haptic="selection"
        scaleTo={0.9}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={styles.item}
      >
        <Animated.View
          style={[styles.disc, { backgroundColor: c.accent }, discStyle]}
          pointerEvents="none"
        />
        {/* Sits under the active disc and above the ground, so an inactive
            item still gets a surface on hover without fighting the indicator. */}
        {!focused && hovered ? (
          <View style={[styles.hoverFill, { backgroundColor: c.accentLight }]} pointerEvents="none" />
        ) : null}

        <Ionicons name={icon} size={21} color={focused ? '#FFFFFF' : c.textMuted} />

        {badge != null ? (
          <View style={[styles.badge, { backgroundColor: c.danger, borderColor: c.bgPage }]}>
            <Text style={styles.badgeText} allowFontScaling={false}>
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        ) : null}
      </PressableScale>

      {/* Web-only: there is no hover on touch, and rendering a tooltip that can
          never be dismissed there would leave it stuck open after a tap. */}
      {Platform.OS === 'web' && hovered ? (
        <View
          style={[
            styles.tooltip,
            { backgroundColor: c.bgContrast },
            Elevation.dark.md,
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.tooltipText, { color: c.onContrast }]}>{label}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  rail: {
    width: RailWidth,
    borderRightWidth: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  brand: {
    marginBottom: Spacing.xl,
  },
  nav: {
    flex: 1,
    gap: Spacing.base,
    alignItems: 'center',
  },
  itemRow: {
    // The tooltip is absolutely positioned against this, and the rail is only
    // 72px wide, so the row must not clip its own overflow.
    position: 'relative',
  },
  item: {
    width: ITEM,
    height: ITEM,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.full,
  },
  hoverFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.full,
  },
  tooltip: {
    position: 'absolute',
    left: ITEM + Spacing.sm,
    top: ITEM / 2 - 14,
    paddingHorizontal: Spacing.base,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    // Above the scene, which is the next sibling in the navigator's row.
    zIndex: 20,
  },
  tooltipText: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  footer: {
    marginTop: Spacing.md,
  },
})
