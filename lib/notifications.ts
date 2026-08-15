import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Low-level scheduling primitives shared by lib/reminders.ts (workflow
// reminders, PRODUCT.md 2.3) and lib/paymentReminders.ts (payment due
// reminders, PRODUCT.md 2.4). Neither of those files talks to
// expo-notifications directly; everything goes through here.

// Renders the notification while the app is in the foreground. Sound/badge
// are off since these are gentle nudges, not urgent alerts.
export function setForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}

// Android requires a channel before any notification can be shown. Safe to
// call on every launch, since creating an existing channel is a no-op.
export async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  })
}

// Requests permission only if the user hasn't already been asked; the OS
// won't re-prompt after a denial, so repeated calls are harmless.
async function ensurePermissionsAsync(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  if (!current.canAskAgain) return false

  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted
}

export interface NotificationContent {
  title: string
  body: string
  data: Record<string, string>
}

// Schedules a local notification for a future date. Returns null (instead of
// throwing) when permission is missing or scheduling otherwise fails:
// callers treat this as best-effort and must never let it block a deal/
// payment save.
export async function scheduleAsync(
  content: NotificationContent,
  fireAt: Date
): Promise<string | null> {
  try {
    const granted = await ensurePermissionsAsync()
    if (!granted) {
      console.warn('scheduleAsync: notification permission not granted, skipping schedule')
      return null
    }

    return await Notifications.scheduleNotificationAsync({
      content: { title: content.title, body: content.body, data: content.data },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    })
  } catch (err) {
    console.error('scheduleAsync: scheduling failed', err)
    return null
  }
}

export async function cancelAsync(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId)
  } catch {
    // Already fired or already cancelled, so nothing to do.
  }
}
