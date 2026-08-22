import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Local storage keys, and moving what is already under the old ones.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * The product was renamed, and four keys on every installed device still
 * carried the old name: the theme choice, the sidebar's collapsed state,
 * which accounts have seen onboarding, and the offline queue.
 *
 * They were left alone at the time because renaming a key does not move what
 * is under it. A plain rename would have signed nobody out and lost nothing
 * dramatic, except for one: `offline.queue.v1` holds deals captured with no
 * signal that have not reached the server yet. Renaming that key abandons
 * them, silently, on the device of somebody who typed them in a basement.
 *
 * So each read migrates first: look under the old name, write it to the new
 * one, remove the old. It runs once per device and then costs a single miss
 * on a key that is not there.
 */

export const StorageKeys = {
  theme: 'blubanana.theme',
  sidebar: 'blubanana.sidebar',
  onboardingPrefix: 'blubanana.onboarding.dismissed.',
  offlineQueue: 'blubanana.offline.queue.v1',
  dismissedAnnouncements: 'blubanana.announcements.dismissed',
  featureFlags: 'blubanana.flags',
  copy: 'blubanana.copy',
} as const

/** What each key used to be called, for the one-time move. */
const PREVIOUS: Record<string, string> = {
  [StorageKeys.theme]: 'creatordesk.theme',
  [StorageKeys.sidebar]: 'creatordesk.sidebar',
  [StorageKeys.offlineQueue]: 'creatordesk.offline.queue.v1',
}

/**
 * Read a key, moving anything found under its old name first.
 *
 * Returns null when neither exists, which is what every caller already
 * expected from `AsyncStorage.getItem`.
 */
export async function readKey(key: string): Promise<string | null> {
  const current = await AsyncStorage.getItem(key)
  if (current !== null) return current

  const previous = PREVIOUS[key]
  if (!previous) return null

  const carried = await AsyncStorage.getItem(previous)
  if (carried === null) return null

  // Write the new one before removing the old, so a crash in between leaves
  // two copies rather than none.
  await AsyncStorage.setItem(key, carried)
  await AsyncStorage.removeItem(previous).catch(() => {})
  return carried
}

/**
 * The onboarding key for one account, moving the old one if it is there.
 *
 * Separate from `readKey` because this one is a prefix plus a user id, so the
 * old name cannot be listed in a fixed table.
 */
export async function readOnboardingFlag(userId: string): Promise<string | null> {
  const key = `${StorageKeys.onboardingPrefix}${userId}`
  const current = await AsyncStorage.getItem(key)
  if (current !== null) return current

  const carried = await AsyncStorage.getItem(`creatordesk.onboarding.dismissed.${userId}`)
  if (carried === null) return null

  await AsyncStorage.setItem(key, carried)
  await AsyncStorage.removeItem(`creatordesk.onboarding.dismissed.${userId}`).catch(() => {})
  return carried
}
