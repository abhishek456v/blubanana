import type { Ionicons } from '@expo/vector-icons'

/**
 * Five destinations, which is the cap.
 *
 * "Work" is the creator's own record of everything she has shipped: the
 * archive plus how each piece performed. It is separate from Home because
 * Home answers "what needs me today" and Work answers "what have I built",
 * which are different questions asked at different moments.
 *
 * Shared between the navigator (which declares the routes) and the dock (which
 * draws them), so the two cannot drift out of order.
 */
export type TabName = 'index' | 'work' | 'money' | 'brands' | 'settings'

export interface TabSpec {
  name: TabName
  title: string
  icon: keyof typeof Ionicons.glyphMap
  iconOutline: keyof typeof Ionicons.glyphMap
}

export const TABS: TabSpec[] = [
  { name: 'index', title: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'work', title: 'Work', icon: 'albums', iconOutline: 'albums-outline' },
  { name: 'money', title: 'Money', icon: 'wallet', iconOutline: 'wallet-outline' },
  { name: 'brands', title: 'Brands', icon: 'people', iconOutline: 'people-outline' },
  { name: 'settings', title: 'You', icon: 'person-circle', iconOutline: 'person-circle-outline' },
]

export const TAB_BY_NAME: Record<string, TabSpec> = Object.fromEntries(
  TABS.map((tab) => [tab.name, tab])
)
