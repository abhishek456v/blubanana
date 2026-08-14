import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { FontFamily, SidebarWidth, Spacing, Typography } from '@/constants/design'
import { Spring } from '@/constants/motion'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { useTheme } from '@/hooks/useTheme'
import { getAlertFeed } from '@/lib/alerts'
import { getProfile } from '@/lib/profile'
import { BrandAvatar } from '@/components/BrandAvatar'
import { Mark, PressableScale } from '@/components/ui'

/**
 * Five destinations, matching DESIGN.md §4's cap.
 *
 * "Work" is the creator's own record of everything she has shipped — the
 * archive plus how each piece performed. It is separate from Home because
 * Home answers "what needs me today" and Work answers "what have I built",
 * which are different questions asked at different moments.
 */
type TabName = 'index' | 'work' | 'money' | 'brands' | 'settings'

const TABS: {
  name: TabName
  title: string
  icon: keyof typeof Ionicons.glyphMap
  iconOutline: keyof typeof Ionicons.glyphMap
}[] = [
  { name: 'index', title: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'work', title: 'Work', icon: 'albums', iconOutline: 'albums-outline' },
  { name: 'money', title: 'Money', icon: 'wallet', iconOutline: 'wallet-outline' },
  { name: 'brands', title: 'Brands', icon: 'people', iconOutline: 'people-outline' },
  { name: 'settings', title: 'You', icon: 'person-circle', iconOutline: 'person-circle-outline' },
]

/**
 * Tab icon that springs up slightly when its tab becomes active.
 *
 * A tab bar is the surface a user touches more than any other, and a static
 * icon swap is the clearest tell that an app was assembled from defaults.
 */
function TabIcon({
  focused,
  color,
  icon,
  iconOutline,
}: {
  focused: boolean
  color: string
  icon: keyof typeof Ionicons.glyphMap
  iconOutline: keyof typeof Ionicons.glyphMap
}) {
  const lift = useSharedValue(focused ? 1 : 0)

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, Spring.snappy)
  }, [focused, lift])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + lift.value * 0.1 }, { translateY: -lift.value * 1.5 }],
  }))

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={focused ? icon : iconOutline} size={22} color={color} />
    </Animated.View>
  )
}

/**
 * The sidebar, with a brand lockup above the nav.
 *
 * react-navigation has no slot above the tab list, so the default bar is
 * wrapped rather than reimplemented — the navigator keeps owning focus,
 * accessibility and the active indicator, and this only adds a header.
 *
 * Without it the sidebar was an unlabelled strip of icons starting at the top
 * edge of the window, which is most of why the desktop layout read as
 * unfinished.
 */
function SidebarWithBrand(props: BottomTabBarProps) {
  const { c } = useTheme()
  const router = useRouter()
  const [creator, setCreator] = useState<{ name: string; niche: string | null } | null>(null)

  // Fetched once for the lifetime of the sidebar rather than on focus: a name
  // in a footer does not need to be live, and re-fetching on every tab change
  // would put a request behind every navigation.
  useEffect(() => {
    let active = true
    getProfile()
      .then((profile) => {
        if (active) setCreator({ name: profile.name, niche: profile.niche })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const displayName = creator?.name?.trim() || 'Your desk'

  return (
    <View style={[styles.sidebar, { backgroundColor: c.bgPage, borderRightColor: c.border }]}>
      <View style={styles.brand}>
        <Mark size={26} color={c.accent} />
        <Text style={[styles.brandWord, { color: c.textPrimary }]}>CreatorDesk</Text>
      </View>

      {/* `BottomTabBar` is wrapped in a flexed View so the footer is pinned to
          the bottom of the sidebar instead of sitting directly under the last
          nav item with the rest of the column left empty. */}
      <View style={styles.navArea}>
        <BottomTabBar {...props} />
      </View>

      <PressableScale
        onPress={() => router.push('/(app)/(tabs)/settings' as never)}
        style={[styles.footer, { borderTopColor: c.border }]}
        accessibilityRole="button"
        accessibilityLabel={`${displayName}, open your profile`}
      >
        <BrandAvatar name={displayName} size={32} />
        <View style={styles.footerText}>
          <Text style={[styles.footerName, { color: c.textPrimary }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.footerMeta, { color: c.textMuted }]} numberOfLines={1}>
            {creator?.niche?.trim() || 'Creator'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={c.textMuted} />
      </PressableScale>
    </View>
  )
}

/**
 * How many things are waiting, for the nav badge.
 *
 * Polled on an interval rather than on focus: the tab bar never loses focus,
 * so a `useFocusEffect` here would fire once at mount and then never again,
 * leaving a stale count on screen for the whole session.
 */
function useDueCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let active = true
    const read = () => {
      getAlertFeed()
        .then((feed) => {
          if (active) setCount(feed.dueCount)
        })
        .catch(() => {})
    }
    read()
    const timer = setInterval(read, 120_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  return count
}

export default function TabsLayout() {
  const { c } = useTheme()
  // Badged on Home because that is where "Needs you" lives — the badge and the
  // list it points at are on the same screen, so tapping it lands somewhere
  // that explains the number.
  const dueCount = useDueCount()
  // DESIGN.md §4: bottom tab bar on mobile, sidebar at desktop widths.
  // tabBarPosition: 'left' is a react-navigation bottom-tabs v7 feature that
  // lays the bar and the scene out as a real flex row rather than an overlay,
  // so this stays one navigator instead of a bespoke sidebar.
  const isWide = useIsWideScreen()

  return (
    <Tabs
      tabBar={isWide ? (props) => <SidebarWithBrand {...props} /> : undefined}
      screenOptions={{
        // Every tab screen draws its own large-title header via ScreenHeader,
        // so the native one is off everywhere. See components/ui/ScreenHeader.
        headerShown: false,
        ...(isWide ? { tabBarPosition: 'left' as const } : null),
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        ...(isWide
          ? {
              tabBarActiveBackgroundColor: c.accentLight,
              tabBarInactiveBackgroundColor: 'transparent',
            }
          : null),
        tabBarStyle: isWide
          ? {
              backgroundColor: 'transparent',
              borderRightWidth: 0,
              width: SidebarWidth,
              paddingTop: Spacing.sm,
            }
          : {
              backgroundColor: c.bgPage,
              borderTopColor: c.border,
              borderTopWidth: 1,
              // The bar is a boundary, not a floating surface — a drop shadow
              // here would be the only one in the app pointing upward.
              elevation: 0,
              shadowOpacity: 0,
              // No explicit height. react-navigation sizes the bar and adds
              // the bottom inset itself; overriding `height` opted out of that
              // and left the buttons inside the home-indicator strip, where
              // the system swallows the touch.
              paddingTop: 6,
            },
        tabBarLabelStyle: {
          fontFamily: FontFamily.medium,
          fontSize: Typography.label.fontSize,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarBadge: tab.name === 'index' && dueCount > 0 ? dueCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: c.danger,
              color: '#FFFFFF',
              fontFamily: FontFamily.semiBold,
              fontSize: 10,
            },
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                icon={tab.icon}
                iconOutline={tab.iconOutline}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}

const styles = StyleSheet.create({
  sidebar: {
    width: SidebarWidth,
    borderRightWidth: 1,
    paddingTop: Spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  brandWord: {
    ...Typography.heading,
    fontFamily: FontFamily.display,
  },
  navArea: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  footerText: {
    flex: 1,
    gap: 1,
  },
  footerName: {
    ...Typography.caption,
    fontFamily: FontFamily.semiBold,
  },
  footerMeta: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
})
