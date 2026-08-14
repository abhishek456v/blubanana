import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeOutDown, SlideInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Elevation, FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { haptic } from '@/lib/haptics'
import { Button } from './Button'
import { Sheet } from './Sheet'

export type ToastTone = 'neutral' | 'success' | 'error' | 'warning'

export interface ToastOptions {
  tone?: ToastTone
  /** Milliseconds before auto-dismiss. `0` keeps it up until tapped. */
  duration?: number
}

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm action in the danger tone. */
  destructive?: boolean
}

interface FeedbackApi {
  toast: (message: string, options?: ToastOptions) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (title: string, message?: string) => Promise<void>
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

interface ToastState {
  id: number
  message: string
  tone: ToastTone
  duration: number
}

interface ConfirmState extends ConfirmOptions {
  id: number
}

const TONE_ICON: Record<ToastTone, keyof typeof Ionicons.glyphMap> = {
  neutral: 'information-circle',
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
}

/**
 * App-wide toast and confirmation host.
 *
 * This exists because `Alert.alert` is literally `static alert() {}` in
 * react-native-web — every validation message and every "are you sure?" in
 * this app vanished silently on web. `lib/alert.ts` patched that by falling
 * through to `window.alert`/`window.confirm`, which is correct but drops the
 * user into unstyled browser chrome mid-flow.
 *
 * These replace both paths with the app's own surfaces, so a destructive
 * confirm looks the same on a phone and in a browser tab.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { c, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const elevation = isDark ? Elevation.dark : Elevation.light

  const [toastState, setToastState] = useState<ToastState | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)
  const nextId = useRef(0)

  const toast = useCallback((message: string, options?: ToastOptions) => {
    const tone = options?.tone ?? 'neutral'
    if (tone === 'success') haptic('success')
    else if (tone === 'error') haptic('error')
    else if (tone === 'warning') haptic('warning')

    setToastState({
      id: nextId.current++,
      message,
      tone,
      duration: options?.duration ?? 3200,
    })
  }, [])

  // Re-armed per toast id, so a second toast arriving mid-display resets the
  // clock instead of inheriting the first one's remaining time.
  useEffect(() => {
    if (!toastState || toastState.duration <= 0) return
    const timer = setTimeout(() => {
      setToastState((current) => (current?.id === toastState.id ? null : current))
    }, toastState.duration)
    return () => clearTimeout(timer)
  }, [toastState])

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setConfirmState(null)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    // A second confirm opening while one is pending would strand the first
    // caller's promise forever, so resolve it as a cancel first.
    resolverRef.current?.(false)
    setConfirmState({ ...options, id: nextId.current++ })
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const alert = useCallback(
    async (title: string, message?: string) => {
      await confirm({ title, message, confirmLabel: 'OK', cancelLabel: '' })
    },
    [confirm]
  )

  const api = useMemo<FeedbackApi>(() => ({ toast, confirm, alert }), [toast, confirm, alert])

  const toneColor: Record<ToastTone, string> = {
    neutral: c.textPrimary,
    success: c.success,
    error: c.danger,
    warning: c.warning,
  }

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      {toastState ? (
        <Animated.View
          key={toastState.id}
          entering={SlideInDown.springify().damping(18)}
          exiting={FadeOutDown.duration(180)}
          pointerEvents="box-none"
          style={[styles.toastHost, { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.lg }]}
        >
          <Pressable
            onPress={() => setToastState(null)}
            accessibilityRole="alert"
            accessibilityLabel={toastState.message}
            style={[
              styles.toast,
              { backgroundColor: c.bgSurfaceRaised, borderColor: c.border },
              elevation.lg,
            ]}
          >
            <Ionicons
              name={TONE_ICON[toastState.tone]}
              size={18}
              color={toneColor[toastState.tone]}
            />
            <Text style={[styles.toastText, { color: c.textPrimary }]} numberOfLines={3}>
              {toastState.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <Sheet
        visible={confirmState !== null}
        onClose={() => settle(false)}
        title={confirmState?.title}
      >
        {confirmState?.message ? (
          <Text style={[styles.confirmMessage, { color: c.textSecondary }]}>
            {confirmState.message}
          </Text>
        ) : null}

        <View style={styles.confirmActions}>
          {confirmState?.cancelLabel !== '' ? (
            <Button
              label={confirmState?.cancelLabel ?? 'Cancel'}
              variant="secondary"
              onPress={() => settle(false)}
              style={styles.confirmButton}
            />
          ) : null}
          <Button
            label={confirmState?.confirmLabel ?? 'Confirm'}
            variant={confirmState?.destructive ? 'danger' : 'primary'}
            haptic={confirmState?.destructive ? 'warning' : 'light'}
            onPress={() => settle(true)}
            style={styles.confirmButton}
          />
        </View>
      </Sheet>
    </FeedbackContext.Provider>
  )
}

function useFeedback(): FeedbackApi {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('useToast/useConfirm must be used inside <FeedbackProvider>')
  }
  return context
}

/** `toast('Deal saved', { tone: 'success' })` */
export function useToast() {
  return useFeedback().toast
}

/** `if (await confirm({ title: 'Delete deal?', destructive: true })) { ... }` */
export function useConfirm() {
  return useFeedback().confirm
}

/** Single-button acknowledgement. Prefer a toast unless it must be dismissed. */
export function useAlert() {
  return useFeedback().alert
}

const styles = StyleSheet.create({
  toastHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    // Above the tab bar and any open screen content, below a Modal (which
    // renders in its own layer on native and at the document root on web).
    zIndex: 200,
    ...Platform.select({ web: { position: 'fixed' as 'absolute' } }),
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: 460,
    width: '100%',
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  toastText: {
    flex: 1,
    ...Typography.body,
    fontFamily: FontFamily.medium,
    lineHeight: 20,
  },
  confirmMessage: {
    ...Typography.body,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  confirmButton: {
    flex: 1,
  },
})
