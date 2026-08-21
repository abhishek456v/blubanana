// Editable copy, fetched once at build time.
//
// ── Why this file has a top level await in it ───────────────────────────────
//
// The content modules build their HTML at import time. By the time build.mjs
// could await anything, every page string has already been decided. A module
// that awaits its own fetch is resolved by Node before anything importing it
// runs, which is the one way to have the copy ready in time without turning
// every content module into a function.
//
// ── Why a fallback is passed at every call site ─────────────────────────────
//
// `t('home.hero.title', 'Brand deals, deadlines and payments...')` reads
// oddly next to a plain string, and it is the reason this cannot produce a
// blank page. No row, no network, no credentials: the sentence that shipped is
// what gets built. A content system that can empty a headline is worse than no
// content system.

import { SUPABASE } from './site.mjs'

async function load() {
  if (!SUPABASE.url || !SUPABASE.anonKey) return {}

  try {
    const response = await fetch(`${SUPABASE.url}/rest/v1/site_content?select=key,value`, {
      headers: { apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`${response.status}`)

    const rows = await response.json()
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  } catch (error) {
    console.warn(`  copy: could not read (${error.message}), using what is in the code`)
    return {}
  }
}

const COPY = await load()

/** The edited version of this line, or the one written here. */
export function t(key, fallback) {
  const value = COPY[key]
  return typeof value === 'string' && value.trim() ? value : fallback
}

/** How many lines came from the database, for the build to report. */
export const editedCount = Object.keys(COPY).length
