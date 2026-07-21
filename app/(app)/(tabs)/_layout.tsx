import { TouchableOpacity, Text, useColorScheme } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, FontFamily, Spacing, SidebarWidth } from '@/constants/design'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'

// Defined as components (not inline JSX) so they can use hooks like useRouter.
function AddDealButton() {
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  return (
    <TouchableOpacity
      onPress={() => router.push('/(app)/deal/new' as never)}
      style={{ marginRight: Spacing.md }}
      hitSlop={{ top: 8, bottom: 8, left: 12, right: 0 }}
    >
      <Text
        style={{
          ...Typography.bodyStrong,
          fontFamily: FontFamily.medium,
          color: c.textPrimary,
        }}
      >
        Add deal
      </Text>
    </TouchableOpacity>
  )
}

function AddBrandButton() {
  const router = useRouter()
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  return (
    <TouchableOpacity
      onPress={() => router.push('/(app)/brand/new' as never)}
      style={{ marginRight: Spacing.md }}
      hitSlop={{ top: 8, bottom: 8, left: 12, right: 0 }}
    >
      <Text
        style={{
          ...Typography.bodyStrong,
          fontFamily: FontFamily.medium,
          color: c.textPrimary,
        }}
      >
        Add brand
      </Text>
    </TouchableOpacity>
  )
}

export default function TabsLayout() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? Colors.dark : Colors.light
  // DESIGN.md 4: bottom tab bar on mobile, sidebar at desktop widths.
  // tabBarPosition: 'left' is a native react-navigation bottom-tabs v7
  // feature — it lays the tab bar and scene content out as a real flex row,
  // not an overlay, so this is the same navigator, not a bespoke sidebar.
  const isWide = useIsWideScreen()

  return (
    <Tabs
      screenOptions={{
        tabBarPosition: isWide ? 'left' : 'bottom',
        tabBarActiveTintColor: c.textPrimary,
        tabBarInactiveTintColor: c.textMuted,
        // The library's default active-item background is an accent blue —
        // DESIGN.md 1 is monochrome only, so swap it for the same neutral
        // surface tone used everywhere else (cards, rows). Bottom tab bar
        // (mobile) doesn't render this block, so it's sidebar-only.
        ...(isWide
          ? { tabBarActiveBackgroundColor: c.bgSurface, tabBarInactiveBackgroundColor: 'transparent' }
          : null),
        tabBarStyle: isWide
          ? {
              backgroundColor: c.bgPage,
              borderRightColor: c.border,
              borderRightWidth: 1,
              width: SidebarWidth,
              paddingTop: Spacing.lg,
            }
          : {
              backgroundColor: c.bgPage,
              borderTopColor: c.border,
              borderTopWidth: 1,
              elevation: 0,
              shadowOpacity: 0,
            },
        tabBarLabelStyle: {
          fontFamily: FontFamily.medium,
          fontSize: Typography.label.fontSize,
        },
        headerStyle: { backgroundColor: c.bgPage },
        headerTitleStyle: {
          fontFamily: FontFamily.semiBold,
          fontSize: Typography.title.fontSize,
          color: c.textPrimary,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerRight: () => <AddDealButton />,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="brands"
        options={{
          title: 'Brands',
          headerRight: () => <AddBrandButton />,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
