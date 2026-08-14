import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error'

/**
 * Fire-and-forget haptic feedback.
 *
 * Every call site treats haptics as decoration, never as something to await or
 * handle failure from, so this swallows both. It has to: the web build has no
 * haptics engine at all, and on Android the call rejects on devices without a
 * vibrator or when the user has disabled system haptics — none of which should
 * ever surface as an error in a button handler.
 *
 * Guidance on which to use:
 *   selection → moving through options (filter pills, segmented control, stars)
 *   light     → an ordinary tap landed (most buttons, row taps)
 *   medium    → a state change the user should feel (sheet snap, toggle)
 *   success / warning / error → the outcome of a submitted action
 */
export function haptic(kind: HapticKind = 'light'): void {
  if (Platform.OS === 'web') return

  try {
    switch (kind) {
      case 'selection':
        void Haptics.selectionAsync().catch(() => {})
        return
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        return
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
        return
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
        return
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
        return
      case 'heavy':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
        return
      case 'light':
      default:
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
  } catch {
    // Synchronous throw from the native module being unavailable entirely.
  }
}
