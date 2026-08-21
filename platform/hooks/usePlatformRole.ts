import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Roles that exist on the platform, as opposed to inside one workspace.
 *
 * `memberships` answers what a manager may see of one creator's business.
 * This answers what a person may see of the business as a whole, and the two
 * must never be confused: an admin is not a member of anybody's workspace.
 */
export type PlatformRole = 'admin' | 'support' | 'finance' | 'editor'

export interface PlatformRoleState {
  role: PlatformRole | null
  /** True until the first answer arrives. Never render an admin screen while true. */
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * What the signed-in person is, at the platform level.
 *
 * Asks the database rather than deciding locally. `platform_role()` is a
 * security definer function reading a table this client has no privileges on
 * at all, so the answer cannot be forged by editing anything the browser can
 * reach. A creator gets null, which is what makes the admin URL being public
 * cost nothing.
 *
 * This is a convenience for rendering, not a security boundary. Every piece
 * of admin *data* is fetched through the `admin` edge function, which asks
 * the same question again on the server. Somebody who patched this hook in
 * their own browser would get an empty dashboard.
 */
export function usePlatformRole(): PlatformRoleState {
  const [role, setRole] = useState<PlatformRole | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      // Asked only when there is a session to ask with.
      //
      // `platform_role()` is executable by `authenticated` and nobody else, so
      // calling it signed out is a 401 every time: a request that cannot
      // succeed, and a red line in the console of anybody who opens the admin
      // address without a session. The answer is the same either way, and the
      // same for the same reason: no session is not a role.
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        setRole(null)
        return
      }

      const { data, error } = await supabase.rpc('platform_role')
      setRole(error ? null : ((data as PlatformRole | null) ?? null))
    } catch {
      // A network failure is not a promotion. Anything other than a clear
      // "yes" leaves the person outside.
      setRole(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // Re-asked whenever the session changes, so signing out of an admin
    // account and into a creator one does not leave the old answer standing.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setLoading(true)
      refresh()
    })
    return () => sub.subscription.unsubscribe()
  }, [refresh])

  return { role, loading, refresh }
}

/** Whether a role may reach a given area. Roles are additive, never subtractive. */
export function roleCan(role: PlatformRole | null, area: AdminArea): boolean {
  if (!role) return false
  if (role === 'admin') return true
  return AREA_ACCESS[area].includes(role)
}

export type AdminArea =
  | 'overview'
  | 'health'
  | 'people'
  | 'subscriptions'
  | 'pricing'
  | 'content'
  | 'announcements'
  | 'media'
  | 'support'
  | 'activity'
  | 'flags'
  | 'requests'

/**
 * Who reaches what.
 *
 * `admin` is absent from every list because it short-circuits above: there is
 * no area an admin cannot reach, and listing it four times invites the day
 * somebody forgets one.
 */
const AREA_ACCESS: Record<AdminArea, PlatformRole[]> = {
  overview: ['support', 'finance', 'editor'],
  health: ['support'],
  people: ['support'],
  subscriptions: ['finance'],
  pricing: ['finance'],
  content: ['editor'],
  announcements: ['editor'],
  media: ['editor', 'support'],
  support: ['support'],
  activity: ['support'],
  // Everybody may look at the switches; only an admin may throw one, which the
  // screen enforces separately. Hiding the page from a role that can read it
  // would only mean nobody knew why a feature had vanished.
  flags: ['support', 'finance', 'editor'],
  // Answering a data request is a legal duty that sits with the fiduciary
  // rather than with whoever happens to be on shift, so: admin only.
  requests: [],
}

/**
 * These lists must agree with ACTION_ACCESS in the admin edge function.
 *
 * They are not the same thing and neither can be derived from the other: this
 * one decides what is worth showing, that one decides what is allowed. When
 * they disagree the failure is mild and visible, which is a link that leads to
 * a refusal rather than a refusal that never happens.
 */
