import { TouchableOpacity, Text, useColorScheme } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, FontFamily, Spacing } from '@/constants/design'

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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.textPrimary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
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
