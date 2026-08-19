import { useCallback, useEffect, useState } from 'react'
import {
  entitlementOf,
  getSubscription,
  trialDealsRemaining,
  type Entitlement,
  type Subscription,
} from '@/lib/subscription'

export interface EntitlementState extends Entitlement {
  subscription: Subscription | null
  /** Null when the trial's deal cap does not apply. */
  dealsLeft: number | null
  loading: boolean
  refresh: () => void
}

/**
 * What this workspace is currently allowed to do.
 *
 * A convenience, never a guarantee. The gate is a restrictive RLS policy
 * (migration 035) — if this hook returned `canWrite: true` for an expired
 * workspace, the database would still refuse the write. Its job is to say so
 * *before* she fills in a form, rather than after.
 *
 * Fails open on error for the same reason the database function does: a
 * network blip while reading a subscription row must not make the app look
 * expired to someone who has paid.
 */
export function useEntitlement(): EntitlementState {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [dealsLeft, setDealsLeft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const current = await getSubscription()
      setSubscription(current)
      setDealsLeft(await trialDealsRemaining(current))
    } catch {
      setSubscription(null)
      setDealsLeft(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return {
    ...entitlementOf(subscription),
    subscription,
    dealsLeft,
    loading,
    refresh: load,
  }
}
