// Blog posts, read from the database at build time.
//
// The site stays static: this runs once, during the build, and the HTML that
// comes out has the full article in it. A search engine crawling a post sees
// the whole thing, which is the only reason those posts exist.
//
// ── What happens when the database cannot be reached ────────────────────────
//
// The build uses the five posts still in `blog.mjs` and prints a warning. A
// static site that fetches its own content has a new way to fail that it did
// not have before: one bad minute during a deploy would publish a site with no
// blog on it, and nobody would find out until search traffic fell weeks later.
// Falling back is not tidy, and it is much better than that.

import { SUPABASE } from './site.mjs'
import { FALLBACK_POSTS } from './content/blog.mjs'

/** `20 August 2026`, the way a date is written on a page rather than stored. */
function dateLabel(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** A database row, in the shape the page templates already expect. */
function toPost(row) {
  return {
    slug: row.slug,
    title: row.title,
    date: row.date,
    dateLabel: dateLabel(row.date),
    read: `${row.read_minutes} min`,
    tool: [row.tool_href, row.tool_label],
    description: row.description,
    lede: row.lede,
    body: row.body_html,
    updated: row.updated ?? undefined,
    cover: row.cover_url ?? undefined,
  }
}

export async function loadPosts({ includeDrafts = false } = {}) {
  if (!SUPABASE.url || !SUPABASE.anonKey) {
    console.warn('  blog: no Supabase credentials, using the posts in blog.mjs')
    return FALLBACK_POSTS
  }

  // Only published ones, and the policy says so too: this filter is a
  // convenience, not the thing keeping drafts off the internet.
  const query = includeDrafts ? '' : '&published=eq.true'

  try {
    const response = await fetch(
      `${SUPABASE.url}/rest/v1/blog_posts?select=*${query}&order=date.desc`,
      {
        headers: { apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}` },
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)

    const rows = await response.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn('  blog: the database returned no posts, using the ones in blog.mjs')
      return FALLBACK_POSTS
    }
    return rows.map(toPost)
  } catch (error) {
    console.warn(`  blog: could not read posts (${error.message}), using the ones in blog.mjs`)
    return FALLBACK_POSTS
  }
}
