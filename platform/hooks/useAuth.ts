import { useCallback, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { clearWorkspaceCache } from '@/lib/workspace'
import { needsCode } from '@/lib/twoFactor'

/**
 * The session, and whether it is finished.
 *
 * ── Why a session is not the same as being signed in ────────────────────────
 *
 * When an account has a second step, a correct password still produces a
 * session. It is just a session at the lower assurance level, which the
 * account has not yet accepted. Treating that as signed in is what made the
 * root layout redirect straight into the app the moment the password landed,
 * unmounting the sign-in screen before it could ask for the code.
 *
 * The effect was that two-step verification did nothing at all: the phone
 * never rang, and with the admin endpoint now insisting on the second level,
 * an admin who enrolled would have been locked out of every screen behind it.
 *
 * So `session` is what exists and `secondStepPending` is whether it counts.
 * Everything that gates on being signed in reads both.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [secondStepPending, setSecondStepPending] = useState(false)
  const [loading, setLoading] = useState(true)

  const check = useCallback(async (next: Session | null) => {
    if (!next) {
      setSecondStepPending(false)
      return
    }
    // Fails closed on purpose: if the question cannot be answered, the code is
    // treated as still owed rather than waved through.
    setSecondStepPending(await needsCode().catch(() => true))
  }, [])

  useEffect(() => {
    // The session that may have been persisted from a previous app launch.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      await check(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // The workspace id is cached for the session. Clearing it on sign-out is
      // what stops the next account signing in on this device from writing
      // rows into the previous account's workspace.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') clearWorkspaceCache()
      setSession(session)
      check(session)
    })

    return () => subscription.unsubscribe()
  }, [check])

  return { session, loading, secondStepPending }
}
