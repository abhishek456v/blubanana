// Shared plumbing for the admin function's action modules.
//
// Nothing here decides who may do what. That happens once, in index.ts, before
// any of this is reached: by the time a module has a Ctx it is holding proof
// that the caller is who they say they are and is allowed to be here.

import { corsHeaders } from '../_shared/cors.ts'

export type PlatformRole = 'admin' | 'support' | 'finance' | 'editor'

/** A Supabase client on the service role. Never handed to a browser. */
// deno-lint-ignore no-explicit-any
export type Db = any

export interface Ctx {
  db: Db
  user: { id: string; email: string | null }
  role: PlatformRole
  body: Record<string, unknown>
  /** Record what this action did. Called once per action, including reads. */
  audit: (detail?: Record<string, unknown>) => Promise<void>
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/**
 * A message meant for the person reading the screen, not for a log.
 *
 * Anything else that throws becomes "something went wrong on our side", which
 * is the right answer for a database error: it tells the admin to try again
 * and tells an attacker nothing about the schema.
 */
export class Refused extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/**
 * Unwrap a PostgREST result, throwing rather than returning empty.
 *
 * This exists because of a bug that shipped: the subscriptions action asked
 * for two columns that do not exist, `data` came back null with the error
 * politely ignored, and the endpoint returned an empty list. An admin screen
 * that says "no subscriptions" when the query is broken is worse than one that
 * says it failed, because nobody investigates good news.
 */
export function rows<T = Record<string, unknown>>(result: {
  data: T[] | null
  error: { message: string } | null
}): T[] {
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export function one<T = Record<string, unknown>>(result: {
  data: T | null
  error: { message: string } | null
}): T {
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Refused('That is not there any more', 404)
  return result.data
}

export function count(result: { count: number | null; error: { message: string } | null }): number {
  if (result.error) throw new Error(result.error.message)
  return result.count ?? 0
}

/** A required string from the request body. */
export function str(body: Record<string, unknown>, key: string): string {
  const value = String(body[key] ?? '').trim()
  if (!value) throw new Refused(`Missing ${key}`)
  return value
}

/** One of a fixed set, or the fallback. Never trusts the body to be sensible. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/**
 * Look up emails for a set of user ids.
 *
 * auth.users is not exposed through PostgREST, so this goes through the admin
 * API. Paged deliberately rather than fetched per id: one round trip for the
 * whole screen instead of one per row.
 */
export async function emailsById(db: Db, ids: string[]): Promise<Record<string, string>> {
  const wanted = new Set(ids.filter(Boolean))
  const found: Record<string, string> = {}
  if (wanted.size === 0) return found

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    const users = data?.users ?? []
    for (const u of users) {
      if (wanted.has(u.id) && u.email) found[u.id] = u.email
    }
    if (users.length < 200) break
  }
  return found
}
