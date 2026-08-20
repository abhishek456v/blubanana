import { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import {
  Elevation,
  FontFamily,
  HitSlop,
  RailWidth,
  Radius,
  SidebarWidth,
  Spacing,
  Typography,
  accentGlow,
} from '@/constants/design'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useTheme, useThemeMode } from '@/hooks/useTheme'
import { getAlertFeed } from '@/lib/alerts'
import { getProfile } from '@/lib/profile'
import { BrandAvatar } from '@/components/BrandAvatar'
import { PressableScale, ThemeToggle } from '@/components/ui'
import { TAB_BY_NAME, type TabName } from './tabs'

// The storage key keeps the old product name on purpose, like every other
// stored key: renaming it would silently reset every existing user's choice.
const COLLAPSE_KEY = 'creatordesk.sidebar'

/** Tab destinations in sidebar order. Settings renders in the group below. */
const MAIN_TABS: TabName[] = ['index', 'money', 'brands', 'work']

/**
 * Deals is a pushed route, not a tab, but it belongs in the nav directly
 * under Home: it is where every "View all" lands and the only place that
 * holds the full list.
 */
const DEALS = { label: 'Deals', path: '/deals', icon: 'briefcase', iconOutline: 'briefcase-outline' } as const

/** Children of Money: pushed routes, indented under the tab. */
const MONEY_SUBS = [
  { label: 'Invoices', path: '/invoices' },
  { label: 'Expenses', path: '/expenses' },
  { label: 'Tax', path: '/tax' },
] as const

/** Pushed workspace routes. Reminders carries the due-count badge. */
const WORKSPACE = [
  {
    label: 'Reminders',
    path: '/reminders',
    icon: 'time' as const,
    iconOutline: 'time-outline' as const,
    badged: true,
  },
  {
    label: 'Team',
    path: '/team',
    icon: 'people-circle' as const,
    iconOutline: 'people-circle-outline' as const,
    badged: false,
  },
  {
    label: 'Rate card',
    path: '/profile/card',
    icon: 'card' as const,
    iconOutline: 'card-outline' as const,
    badged: false,
  },
] as const

/**
 * The desktop navigation: a labelled sidebar, collapsible to an icon rail.
 *
 * Replaces the unlabelled 72px rail (20 Aug redesign). Both of the user's
 * reference designs use a named, grouped sidebar, and the labels are what
 * make eight destinations legible; the old rail could only ever carry five.
 * The rail is not gone: it is the collapsed state, and the choice persists.
 *
 * Still mounted as the tab navigator's `tabBar` with `tabBarPosition: left`,
 * which keeps this one navigator instead of a bespoke shell. The pushed
 * routes it links to (Invoices, Reminders, ...) present as modal sheets over
 * the tabs on wide screens, so the sidebar stays on screen behind them.
 */
export function Sidebar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const { isDesktop } = useBreakpoint()
  // `null` = no stored choice yet. Until one exists, the width decides:
  // labelled on a desktop, collapsed on a tablet, where 248px would eat a
  // third of the window. A stored choice always wins over the default.
  const [choice, setChoice] = useState<boolean | null>(null)
  const collapsed = choice ?? !isDesktop
  const [creator, setCreator] = useState<{ name: string } | null>(null)
  const dueCount = useDueCount()

  useEffect(() => {
    AsyncStorage.getItem(COLLAPSE_KEY)
      .then((stored) => {
        if (stored === 'closed') setChoice(true)
        if (stored === 'open') setChoice(false)
      })
      .catch(() => {})
  }, [])

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

  const toggleCollapsed = () => {
    const next = !collapsed
    setChoice(next)
    AsyncStorage.setItem(COLLAPSE_KEY, next ? 'closed' : 'open').catch(() => {})
  }

  const displayName = creator?.name?.trim() || 'Your desk'

  /** Navigate to a tab, respecting a screen's scroll-to-top preventDefault. */
  const goToTab = (name: TabName) => {
    const index = state.routes.findIndex((route) => route.name === name)
    if (index === -1) return
    const route = state.routes[index]
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    })
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params)
    }
  }

  const isTabActive = (name: TabName) =>
    state.routes[state.index]?.name === name && isTabPath(pathname)
  const settingsActive = isTabActive('settings')

  const width = collapsed ? RailWidth : SidebarWidth

  return (
    <View
      style={[
        styles.sidebar,
        { width, backgroundColor: c.bgPage, borderRightColor: c.border },
        collapsed && styles.sidebarCollapsed,
      ]}
    >
      {/* Wordmark row. Lowercase by decree; see the brand memory. */}
      <View style={[styles.brandRow, collapsed && styles.brandRowCollapsed]}>
        {collapsed ? null : (
          <View style={styles.brandText}>
            <Text style={[styles.wordmark, { color: c.textPrimary }]}>blubanana</Text>
            <Text style={[styles.workspace, { color: c.textMuted }]} numberOfLines={1}>
              {creator?.name ? `${firstName(creator.name)}'s desk` : 'Your desk'}
            </Text>
          </View>
        )}
        <PressableScale
          onPress={toggleCollapsed}
          hitSlop={HitSlop}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          style={[styles.collapseButton, { backgroundColor: c.bgSurface }]}
        >
          <Ionicons
            name={collapsed ? 'chevron-forward' : 'chevron-back'}
            size={14}
            color={c.textSecondary}
          />
        </PressableScale>
      </View>

      <View style={[styles.divider, { backgroundColor: c.border }]} />

      <View style={styles.nav}>
        {MAIN_TABS.map((name) => {
          const spec = TAB_BY_NAME[name]
          const active = isTabActive(name)
          return (
            <View key={name}>
              <Item
                label={name === 'index' ? 'Home' : spec.title}
                icon={active ? spec.icon : spec.iconOutline}
                active={active}
                collapsed={collapsed}
                onPress={() => goToTab(name)}
              />
              {name === 'index' ? (
                <Item
                  label={DEALS.label}
                  icon={pathname === DEALS.path ? DEALS.icon : DEALS.iconOutline}
                  active={pathname === DEALS.path}
                  collapsed={collapsed}
                  onPress={() => router.push(DEALS.path as never)}
                />
              ) : null}
              {name === 'money' && !collapsed
                ? MONEY_SUBS.map((sub) => (
                    <SubItem
                      key={sub.path}
                      label={sub.label}
                      active={pathname === sub.path}
                      onPress={() => router.push(sub.path as never)}
                    />
                  ))
                : null}
            </View>
          )
        })}

        {collapsed ? (
          <View style={[styles.divider, { backgroundColor: c.border }]} />
        ) : (
          <Text style={[styles.groupLabel, { color: c.textMuted }]}>Workspace</Text>
        )}

        {WORKSPACE.map((item) => {
          const active = pathname === item.path
          return (
            <Item
              key={item.path}
              label={item.label}
              icon={active ? item.icon : item.iconOutline}
              active={active}
              collapsed={collapsed}
              badge={item.badged && dueCount > 0 ? dueCount : null}
              onPress={() => router.push(item.path as never)}
            />
          )
        })}
        <Item
          label="Settings"
          icon={settingsActive ? 'options' : 'options-outline'}
          active={settingsActive}
          collapsed={collapsed}
          onPress={() => goToTab('settings')}
        />
      </View>

      <View style={[styles.footer, collapsed && styles.footerCollapsed]}>
        {collapsed ? (
          <ThemeToggle size={40} />
        ) : (
          <ThemeSegment />
        )}
        <PressableScale
          onPress={() => goToTab('settings')}
          accessibilityRole="button"
          accessibilityLabel={`${displayName}, open your profile`}
          style={[
            styles.userCard,
            !collapsed && { backgroundColor: c.bgSurface },
            collapsed && styles.userCardCollapsed,
          ]}
        >
          <BrandAvatar name={displayName} size={30} />
          {collapsed ? null : (
            <View style={styles.userText}>
              <Text style={[styles.userName, { color: c.textPrimary }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.userSub, { color: c.textMuted }]} numberOfLines={1}>
                Your profile
              </Text>
            </View>
          )}
        </PressableScale>
      </View>
    </View>
  )
}

/** `pathname` for the five tabs is `/`, `/work`, `/money`, ... */
function isTabPath(pathname: string): boolean {
  return ['/', '/work', '/money', '/brands', '/settings'].includes(pathname)
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0]
}

/**
 * Due count for the Reminders badge. Polled, not focus-driven: the sidebar
 * never loses focus, so a focus effect would fire once and go stale.
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

function Item({
  label,
  icon,
  active,
  collapsed,
  badge = null,
  onPress,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  active: boolean
  collapsed: boolean
  badge?: number | null
  onPress: () => void
}) {
  const { c } = useTheme()
  const [hovered, setHovered] = useState(false)

  const iconColor = active ? '#FFFFFF' : c.textSecondary

  return (
    <View style={styles.itemRow}>
      <PressableScale
        onPress={onPress}
        haptic="selection"
        scaleTo={0.97}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        style={[
          styles.item,
          collapsed && styles.itemCollapsed,
          active && { backgroundColor: c.accent },
          active && accentGlow(0.25),
          !active && hovered && { backgroundColor: c.accentLight },
        ]}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
        {collapsed ? null : (
          <Text
            style={[
              styles.itemLabel,
              { color: active ? '#FFFFFF' : c.textSecondary },
              active && styles.itemLabelActive,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
        {badge != null && !collapsed ? (
          <View style={[styles.badge, { backgroundColor: c.danger }]}>
            <Text style={styles.badgeText} allowFontScaling={false}>
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        ) : null}
        {badge != null && collapsed ? (
          <View style={[styles.dotBadge, { backgroundColor: c.danger, borderColor: c.bgPage }]} />
        ) : null}
      </PressableScale>

      {/* Collapsed mode pays for its missing labels with a hover tooltip.
          Web-only: touch has no hover, and touch widths use the dock anyway. */}
      {Platform.OS === 'web' && collapsed && hovered ? (
        <View
          style={[styles.tooltip, { backgroundColor: c.bgContrast }, Elevation.dark.md]}
          pointerEvents="none"
        >
          <Text style={[styles.tooltipText, { color: c.onContrast }]}>{label}</Text>
        </View>
      ) : null}
    </View>
  )
}

function SubItem({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  const [hovered, setHovered] = useState(false)
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.97}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[
        styles.subItem,
        active && { backgroundColor: c.accentLight },
        !active && hovered && { backgroundColor: c.bgSurface },
      ]}
    >
      <Text
        style={[styles.subLabel, { color: active ? c.accentText : c.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableScale>
  )
}

/**
 * Light | Dark, spelled out. The icon-only ThemeToggle stays for collapsed
 * mode and for phones, but with 248px available the words are clearer than
 * an icon that must be decoded.
 */
function ThemeSegment() {
  const { c, isDark } = useTheme()
  const { setMode } = useThemeMode()
  return (
    <View style={[styles.segment, { backgroundColor: c.bgSurface }]}>
      {(['light', 'dark'] as const).map((option) => {
        const selected = option === 'dark' ? isDark : !isDark
        return (
          <PressableScale
            key={option}
            onPress={() => setMode(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option === 'dark' ? 'Night mode' : 'Day mode'}
            style={[
              styles.segmentOption,
              selected && { backgroundColor: c.bgSurfaceRaised },
              selected && (isDark ? Elevation.dark.sm : Elevation.light.sm),
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: selected ? c.textPrimary : c.textMuted },
                selected && styles.segmentLabelActive,
              ]}
            >
              {option === 'dark' ? 'Dark' : 'Light'}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  sidebar: {
    borderRightWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    // The collapsed mode's tooltip overhangs into the scene, which is a later
    // sibling in the navigator's row and would otherwise paint over it.
    zIndex: 10,
  },
  sidebarCollapsed: {
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.base,
  },
  brandRowCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  brandText: {
    flex: 1,
    gap: 1,
  },
  wordmark: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    letterSpacing: -0.4,
  },
  workspace: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  collapseButton: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginBottom: Spacing.base,
  },
  nav: {
    flex: 1,
    gap: 2,
    alignSelf: 'stretch',
  },
  itemRow: {
    position: 'relative',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    paddingVertical: 9,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
  },
  itemCollapsed: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: Radius.full,
    alignSelf: 'center',
  },
  itemLabel: {
    ...Typography.body,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  itemLabelActive: {
    fontFamily: FontFamily.semiBold,
  },
  subItem: {
    paddingVertical: 7,
    paddingLeft: Spacing.base + 18 + Spacing.base,
    paddingRight: Spacing.base,
    borderRadius: Radius.md,
  },
  subLabel: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  groupLabel: {
    ...Typography.label,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  dotBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  tooltip: {
    position: 'absolute',
    left: 46 + Spacing.sm,
    top: 23 - 14,
    paddingHorizontal: Spacing.base,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    zIndex: 20,
  },
  tooltipText: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
  },
  footer: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    alignItems: 'stretch',
  },
  footerCollapsed: {
    alignItems: 'center',
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: 3,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  segmentLabel: {
    ...Typography.label,
    fontFamily: FontFamily.medium,
  },
  segmentLabelActive: {
    fontFamily: FontFamily.semiBold,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  userCardCollapsed: {
    alignSelf: 'center',
    padding: 0,
  },
  userText: {
    flex: 1,
    gap: 1,
  },
  userName: {
    ...Typography.caption,
    fontFamily: FontFamily.semiBold,
  },
  userSub: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
  },
})
