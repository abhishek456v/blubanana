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

// Whether the OS will actually deliver anything we schedule.
//
// Exposed so a screen can tell the creator her reminders are switched off.
// Without this the whole feature fails silently: permission is only ever
// requested from inside a save, and once iOS records a denial `canAskAgain`
// goes false, so every later reminder no-ops with nothing on screen to say so.
export async function notificationsEnabledAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  try {
    return (await Notifications.getPermissionsAsync()).granted
  } catch {
    return false
  }
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
    // A DATE trigger in the past is not a reminder the OS can keep. iOS
    // rejects it, and the throw used to land in the catch below and be
    // reported as a generic scheduling failure.
    //
    // This is reached on ordinary input, not just edge cases: reminders fire
    // at 9am on the stage date, so setting a date of *today* any time after
    // breakfast, or back-filling a date that has already passed, both land
    // here. The deal screen surfaces those in-app instead, which is the right
    // place for work that is already due.
    if (fireAt.getTime() <= Date.now()) return null

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

/**
 * What the OS has actually accepted, as opposed to what the database believes
 * it scheduled.
 *
 * These two can disagree for reasons entirely outside the app: iOS drops a
 * pending notification when permission is revoked, caps how many any one app
 * may queue, and clears the queue on reinstall. Reading the real queue is the
 * only way to answer "is my reminder actually set?" without waiting for 9am.
 */
export async function scheduledCountAsync(): Promise<number> {
  if (Platform.OS === 'web') return 0
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length
  } catch {
    return 0
  }
}

/**
 * Fires a reminder a few seconds out, so the whole delivery path can be
 * checked end to end without waiting a day for a real one.
 *
 * Returns what actually happened rather than a boolean, because the useful
 * answers are different: permission refused is a thing the creator can fix in
 * Settings, and a scheduling failure is not.
 */
export async function sendTestAsync(): Promise<'scheduled' | 'denied' | 'failed'> {
  if (Platform.OS === 'web') return 'failed'
  try {
    const granted = await ensurePermissionsAsync()
    if (!granted) return 'denied'

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Reminders are working',
        body: 'This is what a deadline nudge will look like.',
        data: { type: 'test' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        repeats: false,
      },
    })
    return id ? 'scheduled' : 'failed'
  } catch (err) {
    console.error('sendTestAsync: could not schedule the test notification', err)
    return 'failed'
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
