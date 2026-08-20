import { useEffect, useState } from 'react'
import { Tabs } from 'expo-router'
import { useIsWideScreen } from '@/hooks/useIsWideScreen'
import { getAlertFeed } from '@/lib/alerts'
import { Sidebar } from '@/components/nav/Sidebar'
import { TabDock } from '@/components/nav/TabDock'
import { TABS } from '@/components/nav/tabs'

/**
 * How many things are waiting, for the nav badge.
 *
 * Polled on an interval rather than on focus: the nav never loses focus, so a
 * `useFocusEffect` here would fire once at mount and then never again, leaving
 * a stale count on screen for the whole session.
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
  // Badged on Home because that is where "Needs you" lives: the badge and the
  // list it points at are on the same screen, so tapping it lands somewhere
  // that explains the number.
  const dueCount = useDueCount()
  const isWide = useIsWideScreen()

  return (
    <Tabs
      // Icon rail above `wide`, floating dock below it. Both are ours, so none
      // of the library's bar styling options apply any more: `tabBarStyle`,
      // `tabBarIcon`, `tabBarLabelStyle` and the tint colours all fed
      // `BottomTabBar`, which no longer renders at either width.
      //
      // `tabBarBadge` is the exception. It stays a screen option because both
      // of our bars read it back off the descriptor, which keeps the badge
      // declared next to the route it belongs to.
      tabBar={(props) => (isWide ? <Sidebar {...props} /> : <TabDock {...props} />)}
      screenOptions={{
        // Every tab screen draws its own large-title header via ScreenHeader,
        // so the native one is off everywhere. See components/ui/ScreenHeader.
        headerShown: false,
        // Tab switches were instant cuts. `shift` slides the outgoing screen
        // out and the incoming one in along the direction of travel, so moving
        // right through the bar feels like moving right through the app.
        animation: 'shift',
        // Lays the rail and the scene out as a real flex row rather than an
        // overlay, so this stays one navigator instead of a bespoke sidebar.
        ...(isWide ? { tabBarPosition: 'left' as const } : null),
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarBadge: tab.name === 'index' && dueCount > 0 ? dueCount : undefined,
          }}
        />
      ))}
    </Tabs>
  )
}
