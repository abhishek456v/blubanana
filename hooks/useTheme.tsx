import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Platform, useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors } from '@/constants/design'

export type ThemeColors = { readonly [K in keyof typeof Colors.light]: string }

/**
 * `system` follows the OS. The other two are an explicit choice that outlives
 * the OS changing at sunset — which is the whole point of offering a toggle.
 */
export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'creatordesk.theme'

interface ThemeContextValue {
  c: ThemeColors
  isDark: boolean
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** Cycles light → dark → system, for a single-button toggle. */
  cycleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')

  // Restored asynchronously, so the first frame renders in system mode and
  // corrects itself. Blocking render on a disk read to avoid that would trade
  // a one-frame flash for a visible startup delay on every launch.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored)
        }
      })
      .catch(() => {
        // Preference unavailable; system mode is a correct default.
      })
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
  }, [])

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark'

  // Web only: paint the document itself, not just the React tree.
  //
  // Anything outside a rendered screen keeps the browser's default white
  // otherwise — the overscroll gutter, the flash before the first frame, and
  // most visibly the area behind a modal opened by deep link, where no screen
  // is mounted underneath and the dark scrim sat on a white void.
  //
  // `color-scheme` is set alongside it so the browser's own chrome — form
  // controls, scrollbars, the autofill highlight — matches the app's theme
  // rather than the OS's.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const palette = isDark ? Colors.dark : Colors.light
    const root = document.documentElement
    root.style.backgroundColor = palette.bgPage
    root.style.colorScheme = isDark ? 'dark' : 'light'
    if (document.body) document.body.style.backgroundColor = palette.bgPage
  }, [isDark])

  const cycleMode = useCallback(() => {
    // Cycles through what the user is currently seeing, not through the enum:
    // from system, the useful next step is "the opposite of what I see now".
    setMode(isDark ? 'light' : 'dark')
  }, [isDark, setMode])

  const value = useMemo<ThemeContextValue>(
    () => ({
      c: isDark ? Colors.dark : Colors.light,
      isDark,
      mode,
      setMode,
      cycleMode,
    }),
    [isDark, mode, setMode, cycleMode]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * The active palette.
 *
 * `c` is deliberately short — it appears dozens of times per screen in style
 * expressions, and every screen already uses that name.
 *
 * Falls back to the system scheme when no provider is mounted, so a component
 * rendered outside the tree (a test, a storybook) still gets sane colours
 * instead of throwing.
 */
export function useTheme(): { c: ThemeColors; isDark: boolean } {
  const context = useContext(ThemeContext)
  const systemScheme = useColorScheme()

  if (context) return { c: context.c, isDark: context.isDark }

  const isDark = systemScheme === 'dark'
  return { c: isDark ? Colors.dark : Colors.light, isDark }
}

/** Read and change the theme preference. For the toggle control. */
export function useThemeMode(): Pick<ThemeContextValue, 'mode' | 'setMode' | 'cycleMode' | 'isDark'> {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used inside <ThemeProvider>')
  }
  const { mode, setMode, cycleMode, isDark } = context
  return { mode, setMode, cycleMode, isDark }
}
