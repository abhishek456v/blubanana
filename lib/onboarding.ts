import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { getProfile } from './profile'

// Whether to offer the two-step onboarding (profile basics, then payment
// details) when the creator lands on Home.
//
// There is no `onboarded_at` column, on purpose — migrations here are applied
// by hand, and a device flag plus "is the profile still empty?" answers the
// question without one. The combination handles both directions:
//
//   * fresh sign-up on this device        → empty profile, no flag → offer
//   * skipped once                        → flag set              → never again
//   * sign-in on a new device, filled     → profile has data      → don't offer
//   * sign-in on a new device, still empty→ offer once more, which is right —
//     the details are genuinely missing and invoices need them.

const KEY_PREFIX = 'creatordesk.onboarding.dismissed.'

/** Keyed per user so two accounts on one device don't hide each other's. */
async function storageKey(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? `${KEY_PREFIX}${user.id}` : null
}

export async function shouldOfferOnboarding(): Promise<boolean> {
  try {
    const key = await storageKey()
    if (!key) return false
    if ((await AsyncStorage.getItem(key)) != null) return false

    const profile = await getProfile()
    // Any sign of a filled profile means onboarding already happened, here or
    // elsewhere. `name` doesn't count — sign-up sets it.
    return (
      !profile.phone &&
      !profile.niche &&
      profile.follower_count == null &&
      !profile.upi_id &&
      !profile.bank_account_number &&
      !profile.gstin
    )
  } catch {
    // On any doubt, stay out of the way — Home must never be blocked by a
    // failing nicety.
    return false
  }
}

export async function dismissOnboarding(): Promise<void> {
  try {
    const key = await storageKey()
    if (key) await AsyncStorage.setItem(key, new Date().toISOString())
  } catch {
    // Worst case the offer reappears next launch.
  }
}
