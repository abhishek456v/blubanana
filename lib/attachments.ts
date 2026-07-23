import { supabase } from './supabase'

// Deal attachments (contracts/briefs — PRODUCT.md 1) live in Supabase
// Storage, not a DB table — Storage already tracks the file list, so a
// synced-copy table would just be one more thing to keep in sync. See
// supabase/migrations/004_deal_attachments_storage.sql for the bucket + RLS
// policy this all depends on.

const BUCKET = 'attachments'

export interface DealAttachment {
  path: string // full storage path — used for delete/signed URL
  name: string // display name (original filename, timestamp prefix stripped)
  createdAt: string | null
}

function folderPath(creatorId: string, dealId: string): string {
  return `${creatorId}/${dealId}`
}

// Storage objects are named {timestamp}-{sanitized original name} to avoid
// collisions between attachments that share a filename — the prefix is
// stripped back off for display.
function buildObjectName(originalName: string): string {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${Date.now()}-${safe}`
}

function displayName(objectName: string): string {
  return objectName.replace(/^\d+-/, '')
}

export async function listAttachments(dealId: string): Promise<DealAttachment[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folderPath(user.id, dealId), { sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw error

  return (data ?? [])
    .filter((f) => f.id !== null) // excludes the placeholder Storage lists for empty folders
    .map((f) => ({
      path: `${folderPath(user.id, dealId)}/${f.name}`,
      name: displayName(f.name),
      createdAt: f.created_at ?? null,
    }))
}

// Reads the picked file via fetch(uri).blob() — works uniformly for a
// native file:// URI and a web blob: URI, so upload doesn't need to branch
// per platform.
export async function uploadAttachment(
  dealId: string,
  file: { uri: string; name: string; mimeType?: string | null }
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const response = await fetch(file.uri)
  const blob = await response.blob()

  const path = `${folderPath(user.id, dealId)}/${buildObjectName(file.name)}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: file.mimeType ?? undefined })
  if (error) throw error
}

export async function deleteAttachment(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

// The bucket is private — a signed URL is required to open/download a
// file, valid for an hour.
export async function getAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
