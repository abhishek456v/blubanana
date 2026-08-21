// Announcements: one table driving a strip, a popup and a picture, across the
// app and the website.
//
// Publishing is the only state that matters. A row that is not published, or
// is outside its window, is invisible to every reader including an anonymous
// one reading the API directly, because the public policy says so rather than
// because a screen chose not to draw it.

import { Ctx, json, one, oneOf, rows, str } from './lib.ts'

const KINDS = ['news', 'banner', 'alert'] as const
const PLACEMENTS = ['bar', 'popup', 'image'] as const
const SURFACES = ['app', 'website', 'both'] as const
const AUDIENCES = ['everyone', 'trialing', 'paying', 'lapsed'] as const

export async function list(ctx: Ctx) {
  const data = rows(
    await ctx.db
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
  )
  await ctx.audit()
  return json({ rows: data })
}

export async function save(ctx: Ctx) {
  const input = (ctx.body.announcement ?? {}) as Record<string, unknown>
  const title = str(input, 'title')

  // Columns listed one at a time, never spread from the body. A spread would
  // let a crafted request set `created_by` to somebody else, and would silently
  // start accepting any column added to this table in future, which is how a
  // form ends up able to write a field nobody meant to expose.
  //
  // It cuts both ways, and did: placement, image_url and sort_order were added
  // to the table and to the composer, and forgotten here. Every picture and
  // popup saved as a line of text until this was found. Anything added to the
  // table from now on has to be added to this list, on purpose.
  const row = {
    kind: oneOf(input.kind, KINDS, 'banner'),
    placement: oneOf(input.placement, PLACEMENTS, 'bar'),
    title,
    body: input.body ?? null,
    image_url: input.image_url ?? null,
    sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 0,
    surface: oneOf(input.surface, SURFACES, 'both'),
    audience: oneOf(input.audience, AUDIENCES, 'everyone'),
    link_url: input.link_url ?? null,
    link_label: input.link_label ?? null,
    dismissible: input.dismissible ?? true,
    starts_at: input.starts_at ?? new Date().toISOString(),
    ends_at: input.ends_at ?? null,
    published: input.published ?? false,
    updated_at: new Date().toISOString(),
  }

  const id = input.id ? String(input.id) : null
  const saved = one(
    id
      ? await ctx.db.from('announcements').update(row).eq('id', id).select().single()
      : await ctx.db
          .from('announcements')
          .insert({ ...row, created_by: ctx.user.id })
          .select()
          .single()
  )

  await ctx.audit({ id: (saved as { id: string }).id, title, published: row.published })
  return json({ row: saved })
}

export async function remove(ctx: Ctx) {
  const id = str(ctx.body, 'id')
  const { error } = await ctx.db.from('announcements').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await ctx.audit({ id })
  return json({ ok: true })
}
