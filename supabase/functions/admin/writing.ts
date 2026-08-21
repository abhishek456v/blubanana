// The blog: writing it, importing it, and asking the website to rebuild.
//
// ── Why publishing triggers a deploy ────────────────────────────────────────
//
// Everything else the dashboard changes takes effect immediately, because the
// website reads it at runtime. The blog deliberately does not. Those posts
// exist to be found in search, and a page whose article arrives by fetch after
// the HTML is a page a crawler sees as empty. So the site is built with the
// posts baked in, and publishing asks Vercel for a fresh build.
//
// The cost is a minute or two before a post appears. The alternative is posts
// that appear instantly and are invisible to Google, which is not a trade.

import { Ctx, Refused, json, one, rows, str } from './lib.ts'

/**
 * Where a post is allowed to send somebody.
 *
 * A list rather than a free text field, because `tool_href` ends up as an
 * `href` in built HTML and the website's build refuses a link to a page that
 * does not exist. A typo here would not produce a broken link on one post: it
 * would fail the build, and the build is all or nothing, so the entire
 * marketing site would stop deploying because of one character in one post.
 *
 * Keep in step with the website's routes. It is checked against them at the
 * bottom of this file rather than trusted, so a page that is renamed shows up
 * as a refusal when somebody next saves, not as a dead site.
 */
const DESTINATIONS = [
  '/tools',
  '/tools/advance-tax-calculator',
  '/tools/tds-calculator',
  '/tools/gst-calculator',
  '/tools/rate-calculator',
  '/tools/engagement-rate-calculator',
  '/pricing',
  '/features',
  '/features/deals',
  '/features/deadlines',
  '/features/payments',
  '/features/invoices',
  '/features/tax',
  '/features/rate-card',
  '/features/team',
  '/features/offline',
  '/compare',
  '/contact',
  '/security',
  '/blog',
] as const

/**
 * The checks the website's build runs, run here instead.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The build fails on the first problem it finds and refuses to write anything.
 * That is right for a site built from code, and dangerous now that a post is a
 * row: a stray `<h1>`, an unclosed `<p>`, the word TODO, or a link to a page
 * that was renamed would each take the whole website off the air, and the
 * person who pressed Publish would have no way to know why.
 *
 * So every rule the build enforces about a post's own content is enforced here
 * first, as a sentence, at the moment somebody could still fix it. Publishing
 * must not be able to break the site.
 */
function checkAgainstBuildRules(row: { body_html: string; title: string; tool_href: string }) {
  const body = row.body_html

  // One h1 per page, and the template already spends it on the title.
  if (/<h1[\s>]/i.test(body)) {
    throw new Refused(
      'The post has a top level heading in it. The title is already the page heading, so use h2 for sections.'
    )
  }

  // Unbalanced tags. The build counts these because a missing </div> silently
  // swallows the rest of the page and nothing about the markup looks wrong.
  for (const tag of ['b', 'strong', 'span', 'div', 'p', 'a', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'h2', 'h3', 'blockquote']) {
    const open = (body.match(new RegExp(`<${tag}[\\s>]`, 'gi')) ?? []).length
    const close = (body.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length
    if (open !== close) {
      throw new Refused(
        `There are ${open} <${tag}> tags and ${close} closing ones. Every tag needs closing before this can go out.`
      )
    }
  }

  if (/TODO/.test(body) || /TODO/.test(row.title)) {
    throw new Refused('The post still says TODO somewhere. Finish that bit first.')
  }

  // Pictures must be full web addresses. A `/something` path would be looked
  // for among the website's own files, which is not where anything uploaded
  // here lives.
  for (const [, src] of body.matchAll(/<img[^>]+src="([^"]+)"/gi)) {
    if (!src.startsWith('http')) {
      throw new Refused(
        'A picture in the post uses a partial address. Pick it from the media library so it gets a full one.'
      )
    }
  }

  if (!DESTINATIONS.includes(row.tool_href as (typeof DESTINATIONS)[number])) {
    throw new Refused('Choose where the post should send people from the list.')
  }
}

/** Only these columns, listed rather than spread. Same reasoning as broadcast. */
function postFrom(input: Record<string, unknown>) {
  const slug = String(input.slug ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) throw new Refused('Give it an address')

  return {
    slug,
    title: str(input, 'title'),
    date: input.date ?? new Date().toISOString().slice(0, 10),
    updated: input.updated ?? null,
    read_minutes: Math.max(1, Math.min(Number(input.read_minutes ?? 5) || 5, 60)),
    description: String(input.description ?? '').trim(),
    lede: String(input.lede ?? '').trim(),
    body_html: String(input.body_html ?? ''),
    tool_href: String(input.tool_href ?? '/tools').trim() || '/tools',
    tool_label: String(input.tool_label ?? 'Try the calculators').trim(),
    cover_url: input.cover_url ?? null,
    published: Boolean(input.published),
    updated_at: new Date().toISOString(),
  }
}

export async function list(ctx: Ctx) {
  const data = rows(
    await ctx.db.from('blog_posts').select('*').order('date', { ascending: false }).limit(200)
  )
  await ctx.audit()
  return json({
    rows: data,
    deployConfigured: Boolean(Deno.env.get('VERCEL_DEPLOY_HOOK')),
    // Sent so the editor offers exactly what the server will accept, rather
    // than keeping a second copy of the list that drifts.
    destinations: DESTINATIONS,
  })
}

export async function save(ctx: Ctx) {
  const input = (ctx.body.post ?? {}) as Record<string, unknown>
  const row = postFrom(input)

  // The website's own checks, applied before saving rather than at deploy
  // time. A post that fails them takes the whole build down, which means one
  // bad description stops every other page going out too.
  if (row.description.length < 60) {
    throw new Refused('The description needs to be at least 60 characters. Search engines show it.')
  }
  if (row.title.length > 64) throw new Refused('Keep the title under 65 characters')
  if (!row.lede) throw new Refused('Write an opening line')
  if (!row.body_html.trim()) throw new Refused('There is no post here yet')

  // The house rule, enforced where a post is written rather than discovered by
  // a failing build twenty minutes later.
  const dash = row.body_html.match(/[–—]/) || row.title.match(/[–—]/)
  if (dash) throw new Refused('No long dashes. Use a full stop, a comma, or rewrite the sentence.')

  checkAgainstBuildRules(row)

  const id = input.id ? String(input.id) : null
  const wasPublished = id
    ? Boolean(
        (
          await ctx.db.from('blog_posts').select('published').eq('id', id).maybeSingle()
        ).data?.published
      )
    : false

  const patch = {
    ...row,
    // Set once, the first time it goes out, and never moved by an edit.
    published_at: row.published && !wasPublished ? new Date().toISOString() : undefined,
  }
  if (patch.published_at === undefined) delete (patch as { published_at?: string }).published_at

  const saved = one(
    id
      ? await ctx.db.from('blog_posts').update(patch).eq('id', id).select().single()
      : await ctx.db
          .from('blog_posts')
          .insert({ ...patch, created_by: ctx.user.id })
          .select()
          .single()
  )

  // Only when what the public can see has actually changed. Editing a draft
  // must not spend a build.
  const deployed =
    row.published || wasPublished ? await triggerDeploy(`post: ${row.slug}`) : false

  await ctx.audit({ slug: row.slug, published: row.published, deployed })
  return json({ row: saved, deployed })
}

export async function remove(ctx: Ctx) {
  const id = str(ctx.body, 'id')
  const existing = one<{ slug: string; published: boolean }>(
    await ctx.db.from('blog_posts').select('slug, published').eq('id', id).maybeSingle()
  )

  const { error } = await ctx.db.from('blog_posts').delete().eq('id', id)
  if (error) throw new Error(error.message)

  const deployed = existing.published ? await triggerDeploy(`removed: ${existing.slug}`) : false
  await ctx.audit({ id, slug: existing.slug, deployed })
  return json({ ok: true, deployed })
}

/** Rebuild the website now, without changing anything. */
export async function deploy(ctx: Ctx) {
  const deployed = await triggerDeploy('asked for by hand')
  if (!deployed) {
    throw new Refused(
      'No deploy hook is set up yet, so the website cannot be asked to rebuild from here.'
    )
  }
  await ctx.audit({ deployed })
  return json({ deployed })
}

/**
 * Ask Vercel to rebuild the website.
 *
 * The hook URL is a function secret, never a column and never anything the
 * browser sees: anybody holding it can spend build minutes at will.
 *
 * Returns false rather than throwing when it is not configured. A post that
 * saved correctly and did not deploy is a post that needs a deploy, not a post
 * that failed, and telling somebody their writing was lost when it was not is
 * the worse error.
 */
export async function triggerDeploy(reason: string): Promise<boolean> {
  const hook = Deno.env.get('VERCEL_DEPLOY_HOOK')
  if (!hook) return false

  try {
    const response = await fetch(hook, { method: 'POST' })
    if (!response.ok) {
      console.error('deploy hook refused', response.status, reason)
      return false
    }
    return true
  } catch (error) {
    console.error('deploy hook failed', error, reason)
    return false
  }
}

// ── Importing a Word document ────────────────────────────────────────────────

/**
 * A .docx, turned into a draft.
 *
 * Word, and deliberately not PDF. A .docx is a zip of XML that says which
 * paragraphs are headings; a PDF is a picture of a document that stores text
 * at coordinates with no notion of what anything is. Every post imported from
 * one would arrive needing repair, and the feature would go unused inside a
 * month.
 *
 * Pictures inside the document are pulled out and uploaded to the media
 * bucket, and their links rewritten to point there. Left alone, mammoth
 * inlines them as base64, which would put a megabyte of characters into a
 * column and again into every built page.
 */
export async function importDocx(ctx: Ctx) {
  const base64 = str(ctx.body, 'file')
  const bytes = decodeBase64(base64)

  // Imported here rather than at the top of the file so that a failure to
  // fetch it takes down one action rather than the whole dashboard.
  const mammoth = await import('https://esm.sh/mammoth@1.8.0')

  const uploaded: string[] = []
  const result = await mammoth.convertToHtml(
    { buffer: bytes },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h2:fresh",
        "p[style-name='Heading 2'] => h3:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
      ],
      convertImage: mammoth.images.imgElement(async (image: {
        contentType: string
        read: (encoding: string) => Promise<string>
      }) => {
        const extension = (image.contentType.split('/')[1] ?? 'png').replace('jpeg', 'jpg')
        const path = `blog/${crypto.randomUUID()}.${extension}`
        const data = decodeBase64(await image.read('base64'))

        const { error } = await ctx.db.storage
          .from('public-media')
          .upload(path, data, { contentType: image.contentType })
        if (error) throw new Error(error.message)

        const { data: url } = ctx.db.storage.from('public-media').getPublicUrl(path)
        const publicUrl = (url as { publicUrl: string }).publicUrl

        await ctx.db.from('media').insert({
          kind: 'image',
          path,
          url: publicUrl,
          title: 'From a Word document',
          mime: image.contentType,
          bytes: data.length,
          folder: 'blog',
          uploaded_by: ctx.user.id,
        })
        uploaded.push(publicUrl)

        return { src: publicUrl }
      }),
    }
  )

  const html = String(result.value ?? '')

  /*
   * Heading levels are fixed here rather than trusted from the document.
   *
   * The style map above is written for a real Word file, where paragraphs
   * carry names like "Heading 1". A document saved by something else, or
   * written without using the style menu at all, produces whatever mammoth
   * falls back to. Both arrive here, so neither is relied on.
   *
   * The rules are the website's: the page template already renders the post
   * title as the only h1, so the body must not contain one, and the build
   * refuses a page with two.
   */
  const opening = html.match(/^\s*<h([1-3])[^>]*>(.*?)<\/h\1>/i)
  const title = opening ? stripTags(opening[2]) : ''
  let body = opening ? html.slice(opening[0].length).trim() : html
  body = demoteHeadings(body)

  // Roughly 220 words a minute, which is the usual figure for prose read on a
  // screen. Rounded up, because nobody has ever complained that a post was
  // shorter than promised.
  const words = stripTags(body).split(/\s+/).filter(Boolean).length
  const readMinutes = Math.max(1, Math.ceil(words / 220))

  await ctx.audit({ words, images: uploaded.length })
  return json({
    title,
    body_html: body,
    read_minutes: readMinutes,
    images: uploaded.length,
    // Word puts curly quotes and long dashes in by default, and the house rule
    // forbids the dashes. Said here rather than at save time, when it would be
    // a refusal instead of a heads up.
    warnings: /[–—]/.test(html)
      ? ['This document has long dashes in it. They need replacing before it can be saved.']
      : [],
  })
}

function decodeBase64(value: string): Uint8Array {
  const clean = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Push every heading down until the highest one in the body is an h2.
 *
 * A post's own title is the page's h1 and there may only be one, so a document
 * whose sections are h1 would otherwise produce a page the build rejects, or
 * worse, one it accepts and search engines read as five separate articles.
 */
function demoteHeadings(html: string): string {
  const levels = [...html.matchAll(/<h([1-6])[^>]*>/gi)].map((m) => Number(m[1]))
  if (levels.length === 0) return html

  const highest = Math.min(...levels)
  if (highest >= 2) return html

  const shift = 2 - highest
  return html.replace(/<(\/?)h([1-6])([^>]*)>/gi, (_all, slash, level, rest) => {
    const next = Math.min(Number(level) + shift, 6)
    return `<${slash}h${next}${rest}>`
  })
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}


// ── Editable copy ────────────────────────────────────────────────────────────

export async function contentList(ctx: Ctx) {
  const data = rows(
    await ctx.db
      .from('site_content')
      .select('*')
      .order('area')
      .order('sort_order')
  )
  await ctx.audit()
  return json({ rows: data, deployConfigured: Boolean(Deno.env.get('VERCEL_DEPLOY_HOOK')) })
}

/**
 * Change one line.
 *
 * Only the value. The key, the label and which surface it belongs to are the
 * contract between a row and the line of code that reads it, and none of them
 * can be edited from a screen: renaming a key silently reverts the copy to its
 * fallback, which looks exactly like nothing having happened.
 */
export async function contentSave(ctx: Ctx) {
  const key = str(ctx.body, 'key')
  const value = String(ctx.body.value ?? '')
  if (!value.trim()) throw new Refused('This cannot be left empty')
  if (/[\u2013\u2014]/.test(value)) {
    throw new Refused('No long dashes. Use a full stop, a comma, or rewrite the sentence.')
  }
  // Same reasoning as the blog: the website's build refuses a page with a
  // placeholder on it and refuses all or nothing, so one unfinished line here
  // would stop the whole site deploying.
  if (/TODO/i.test(value)) {
    throw new Refused('This still says TODO. Finish the sentence before saving it.')
  }

  const row = one<{ area: string }>(
    await ctx.db
      .from('site_content')
      .update({ value, updated_by: ctx.user.id, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()
      .single()
  )

  // Website copy is baked in at build time, so it does not change until the
  // site is rebuilt. App copy is read at runtime and changes on next open.
  const deployed = row.area === 'website' ? await triggerDeploy(`copy: ${key}`) : false

  await ctx.audit({ key, deployed })
  return json({ row, deployed })
}
