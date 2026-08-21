import { supabase } from './supabase'
import { base64ToBytes } from './bytes'

// Profile photos, and getting one onto the rate card (§8.11, migration 032).
//
// Up to three, so she can keep a different shot for a fashion brand than for a
// tech brand. One is marked as the card's, and the card falls back to a
// monogram when there is none.

const BUCKET = 'profile-photos'

export const MAX_PROFILE_PHOTOS = 3

export interface ProfilePhoto {
  id: string
  user_id: string
  path: string
  sort_order: number
  created_at: string
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

export async function getProfilePhotos(): Promise<ProfilePhoto[]> {
  const { data, error } = await supabase
    .from('profile_photos')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ProfilePhoto[]
}

/**
 * Uploads a picked image and records it.
 *
 * Takes base64 because that is what `expo-image-picker` hands back with
 * `base64: true`, and it is the one representation that behaves the same on
 * web and native — a `file://` URI cannot be fetched into a blob on every
 * platform, which is where this usually goes wrong.
 *
 * The three-photo limit is a database trigger, so a race between two devices
 * cannot land a fourth. This surfaces it as a sentence rather than a
 * constraint name.
 */
export async function uploadProfilePhoto(
  base64: string,
  extension = 'jpg'
): Promise<ProfilePhoto> {
  const userId = await currentUserId()
  // The folder is the user id because that is what the storage policy checks.
  const path = `${userId}/${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(base64), {
      contentType: extension === 'png' ? 'image/png' : 'image/jpeg',
      upsert: false,
    })
  if (uploadError) throw uploadError

  const existing = await getProfilePhotos()

  const { data, error } = await supabase
    .from('profile_photos')
    .insert({ user_id: userId, path, sort_order: existing.length })
    .select()
    .single()

  if (error) {
    // The row is the only record that the object exists (032), so an orphaned
    // file would be invisible and undeletable from the app. Clean up.
    await supabase.storage.from(BUCKET).remove([path])
    if (error.code === '23514' || /at most three/i.test(error.message)) {
      throw new Error(`You can keep up to ${MAX_PROFILE_PHOTOS} photos. Remove one first.`)
    }
    throw error
  }

  return data as ProfilePhoto
}

export async function deleteProfilePhoto(photo: ProfilePhoto): Promise<void> {
  // Row first: if the object delete fails, a file lingers in storage but the
  // app is consistent. The other order leaves a row pointing at nothing, which
  // renders as a broken image on the card.
  const { error } = await supabase.from('profile_photos').delete().eq('id', photo.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([photo.path])
}

/** Marks which photo the card uses. Null clears it back to the monogram. */
export async function setCardPhoto(photoId: string | null): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('profiles')
    .update({ card_photo_id: photoId })
    .eq('id', userId)
  if (error) throw error
}

/**
 * A photo as a `data:` URI, for embedding in the card document.
 *
 * The card is rendered to a PDF that has to survive being forwarded to a
 * brand's finance team, so the image has to travel inside it. A signed URL
 * would expire; an unsigned one would not resolve at all.
 */
export async function photoAsDataUri(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) return null

  return new Promise<string | null>((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => resolve(null)
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(data)
  })
}
