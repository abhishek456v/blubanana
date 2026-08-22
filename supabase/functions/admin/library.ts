// The media library.
//
// ── How a file gets in ──────────────────────────────────────────────────────
//
// Not by the browser writing to storage. There is no policy that would let it:
// `public-media` has a read policy and nothing else, so every client write is
// refused by row-level security.
//
// Instead the browser asks here for permission to upload one file. This checks
// the caller's platform role, invents the path itself so the client cannot
// choose where the file lands, and hands back a signed upload URL that works
// once and expires. The right to write is granted per file, by the server, and
// it does not outlive the upload.
//
// Then the browser calls back to register what it uploaded, which is what puts
// the row in `media` and makes the file findable. A file uploaded without that
// second call is an orphan in the bucket, which `sweep` below cleans up.

import { Ctx, Refused, json, one, oneOf, rows, str } from './lib.ts'

const BUCKET = 'public-media'
const KINDS = ['image', 'video', 'document'] as const

/** Extension from a mime type. Not from the filename, which the client picks. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
}

export async function list(ctx: Ctx) {
  const folder = ctx.body.folder ? String(ctx.body.folder) : null
  let query = ctx.db.from('media').select('*').order('created_at', { ascending: false }).limit(300)
  if (folder && folder !== 'all') query = query.eq('folder', folder)

  const data = rows(await query)
  const folders = [...new Set(rows<{ folder: string }>(await ctx.db.from('media').select('folder')).map((r) => r.folder))].sort()

  await ctx.audit({ folder })
  return json({ rows: data, folders })
}

/**
 * Permission to upload exactly one file, to a path of our choosing.
 *
 * The path is built here from a random id and the extension implied by the
 * mime type, never from the name the client sent. A filename from a client is
 * an instruction about where to write, and the classic way that goes wrong is
 * `../` in the middle of it.
 */
export async function uploadUrl(ctx: Ctx) {
  const mime = str(ctx.body, 'mime')
  const extension = EXTENSIONS[mime]
  if (!extension) throw new Refused('That kind of file is not allowed here')

  const folder = safeFolder(ctx.body.folder)
  const path = `${folder}/${crypto.randomUUID()}.${extension}`

  const { data, error } = await ctx.db.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) throw new Error(error.message)

  await ctx.audit({ path, mime })
  return json({ path, token: (data as { token: string }).token, bucket: BUCKET })
}

/** Record a file that has just been uploaded, and make it findable. */
export async function register(ctx: Ctx) {
  const { db, body } = ctx
  const path = str(body, 'path')
  const mime = str(body, 'mime')

  // Trust nothing about the upload having happened. Ask storage.
  const folder = path.split('/')[0]
  const name = path.split('/').slice(1).join('/')
  const { data: found, error: listError } = await db.storage
    .from(BUCKET)
    .list(folder, { search: name, limit: 1 })
  if (listError) throw new Error(listError.message)
  const object = (found ?? [])[0]
  if (!object) throw new Refused('That file did not arrive. Try the upload again.')

  const { data: publicUrl } = db.storage.from(BUCKET).getPublicUrl(path)

  const row = one(
    await db
      .from('media')
      .insert({
        kind: oneOf(body.kind, KINDS, mime.startsWith('video') ? 'video' : mime.startsWith('image') ? 'image' : 'document'),
        path,
        url: (publicUrl as { publicUrl: string }).publicUrl,
        title: String(body.title ?? '').trim() || 'Untitled',
        alt: body.alt ? String(body.alt) : null,
        mime,
        bytes: Number((object as { metadata?: { size?: number } }).metadata?.size ?? 0),
        width: body.width ? Number(body.width) : null,
        height: body.height ? Number(body.height) : null,
        folder,
        uploaded_by: ctx.user.id,
      })
      .select()
      .single()
  )

  await ctx.audit({ path })
  return json({ row })
}

export async function update(ctx: Ctx) {
  const id = str(ctx.body, 'id')
  const patch: Record<string, unknown> = {}
  if (ctx.body.title !== undefined) patch.title = String(ctx.body.title).trim() || 'Untitled'
  if (ctx.body.alt !== undefined) patch.alt = ctx.body.alt ? String(ctx.body.alt) : null
  if (Object.keys(patch).length === 0) throw new Refused('Nothing to change')

  const row = one(await ctx.db.from('media').update(patch).eq('id', id).select().single())
  await ctx.audit({ id, patch })
  return json({ row })
}

/**
 * Delete the file and the row, in that order.
 *
 * Storage first: a row pointing at a file that is gone shows a broken picture,
 * which somebody notices. A file with no row is invisible and stays for ever.
 */
export async function remove(ctx: Ctx) {
  const id = str(ctx.body, 'id')
  const row = one<{ path: string; url: string }>(
    await ctx.db.from('media').select('path, url').eq('id', id).maybeSingle()
  )

  /*
   * Everything that keeps its own copy of this URL.
   *
   * Deleting the file does not break a reference, it breaks the picture, and
   * nothing downstream notices: the website's build only checks that local
   * asset paths exist, and these are full addresses to storage, so a post
   * pointing at a deleted file passes every check and renders a broken image
   * on a live page.
   *
   * This checked announcements only at first, which covered one of the four
   * places a picture can end up.
   */
  const [announcements, covers, inPosts, inCopy] = await Promise.all([
    ctx.db.from('announcements').select('title').eq('image_url', row.url),
    ctx.db.from('blog_posts').select('title').eq('cover_url', row.url),
    ctx.db.from('blog_posts').select('title').like('body_html', `%${row.path}%`),
    ctx.db.from('site_content').select('label').like('value', `%${row.path}%`),
  ])

  const users = [
    ...rows<{ title: string }>(announcements).map((r) => `the broadcast "${r.title}"`),
    ...rows<{ title: string }>(covers).map((r) => `the post "${r.title}" (its cover)`),
    ...rows<{ title: string }>(inPosts).map((r) => `the post "${r.title}"`),
    ...rows<{ label: string }>(inCopy).map((r) => r.label),
  ]
  // A post can hold the same picture as its cover and in its body.
  const unique = [...new Set(users)]

  if (unique.length > 0 && !ctx.body.force) {
    throw new Refused(
      `Still used by ${unique.slice(0, 3).join(', ')}${unique.length > 3 ? ` and ${unique.length - 3} more` : ''}`,
      409
    )
  }

  const { error: storageError } = await ctx.db.storage.from(BUCKET).remove([row.path])
  if (storageError) throw new Error(storageError.message)

  const { error } = await ctx.db.from('media').delete().eq('id', id)
  if (error) throw new Error(error.message)

  await ctx.audit({ id, path: row.path, forced: Boolean(ctx.body.force) })
  return json({ ok: true })
}

/**
 * Files in the bucket that no row knows about.
 *
 * These come from an upload that finished after the browser was closed, or
 * before a register call failed. Nothing renders them and nothing lists them,
 * so without this they accumulate silently and are charged for.
 */
export async function sweep(ctx: Ctx) {
  const known = new Set(rows<{ path: string }>(await ctx.db.from('media').select('path')).map((r) => r.path))
  const folders = ['general', 'website', 'blog', 'app', 'broadcast']
  const orphans: string[] = []

  for (const folder of folders) {
    const { data } = await ctx.db.storage.from(BUCKET).list(folder, { limit: 1000 })
    for (const object of data ?? []) {
      const path = `${folder}/${(object as { name: string }).name}`
      if (!known.has(path)) orphans.push(path)
    }
  }

  if (orphans.length > 0 && ctx.body.confirm) {
    const { error } = await ctx.db.storage.from(BUCKET).remove(orphans)
    if (error) throw new Error(error.message)
  }

  await ctx.audit({ orphans: orphans.length, removed: Boolean(ctx.body.confirm) })
  return json({ orphans, removed: Boolean(ctx.body.confirm) })
}

/**
 * One of a fixed set of folders.
 *
 * Not free text: the folder becomes the first segment of a storage path, and
 * free text there is how a path traversal starts. A new folder is a code
 * change, which is the correct amount of friction for something that decides
 * where files live.
 */
function safeFolder(value: unknown): string {
  return oneOf(value, ['general', 'website', 'blog', 'app', 'broadcast'] as const, 'general')
}
