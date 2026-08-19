import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { clearWorkspaceCache } from '@/lib/workspace'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get the session that may have been persisted from a previous app launch.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
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
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading }
}
