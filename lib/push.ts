import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'

/**
 * Registers this device to receive push notifications.
 *
 * Called once per signed-in launch. The token changes on reinstall and can be
 * reissued by the OS, so it is upserted every time rather than written once and
 * trusted forever.
 *
 * Returns the token, or null when push is unavailable — which is a normal
 * outcome, not an error:
 *
 *   - a simulator has no push service at all
 *   - the web build has no Expo push token (browser push is a different
 *     mechanism and is not wired up)
 *   - the creator declined the permission, which is hers to decline
 *
 * Callers should treat null as "this device will not be pushed to" and carry
 * on. Nothing else in the app depends on it succeeding.
 */
export async function registerPushToken(): Promise<string | null> {
  // Push requires real hardware. On a simulator getExpoPushTokenAsync throws
  // rather than returning null, so this guard is what keeps development from
  // erroring on every launch.
  if (!Device.isDevice) return null
  if (Platform.OS === 'web') return null

  const existing = await Notifications.getPermissionsAsync()
  let status = existing.status

  // Only ask if we have never been answered. Re-asking after a denial does
  // nothing on iOS (the OS ignores it) and is rude on Android.
  if (status !== 'granted' && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync()
    status = requested.status
  }
  if (status !== 'granted') return null

  // The project id is required by Expo's push service in SDK 49+. Without it
  // getExpoPushTokenAsync throws a confusing "No projectId found" at runtime,
  // so it is read explicitly and reported as the configuration problem it is.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

  if (!projectId) {
    console.warn('[push] No EAS projectId in app config; push notifications are disabled.')
    return null
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  if (!token) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const workspaceId = await getWorkspaceId()

  // Conflict on the token, not on (user, device): the same physical device can
  // be signed into a different account, and the row should follow the token to
  // its current owner rather than leaving two rows pointing at one phone.
  const { error } = await supabase.from('push_tokens').upsert(
    {
      workspace_id: workspaceId,
      user_id: user.id,
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'token' }
  )

  if (error) {
    console.warn('[push] Could not save the device token:', error.message)
    return null
  }

  return token
}

/**
 * Forgets this device, on sign-out.
 *
 * Without it the next person to sign in on a shared phone keeps receiving the
 * previous creator's deadlines, which leaks her brand names and her schedule.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!Device.isDevice || Platform.OS === 'web') return

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    if (token) await supabase.from('push_tokens').delete().eq('token', token)
  } catch {
    // Best effort. A device that cannot produce its token has nothing to
    // delete, and blocking sign-out on this would be worse than the leak it
    // prevents.
  }
}
