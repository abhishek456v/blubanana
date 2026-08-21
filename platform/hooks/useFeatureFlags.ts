import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'

/** Keys that exist. Adding one here and in migration 043 is the whole job. */
export type FeatureKey = 'instagram' | 'youtube' | 'ai_capture' | 'sign_ups' | 'payments'

const CACHE_KEY = 'blubanana.flags'

/**
 * Feature switches, so a broken integration can be turned off without a
 * release.
 *
 * ── Why these fail open ─────────────────────────────────────────────────────
 *
 * An unknown answer means enabled, always. The realistic failure is a phone
 * with no signal, and a flag that failed closed would empty the product every
 * time somebody went through a tunnel. The thing being guarded against here is
 * "Meta changed something and Instagram figures are nonsense", which is a
 * decision made once, from a desk, with a connection.
 *
 * ── Why the answer is cached ────────────────────────────────────────────────
 *
 * The flags are read before the first screen draws. Waiting on a network round
 * trip to decide whether to show a button means the button appears late, which
 * looks exactly like a bug. The cached answer paints immediately and the fresh
 * one replaces it a moment later.
 */
let cache: Record<string, boolean> | null = null
let inFlight: Promise<Record<string, boolean>> | null = null

async function fetchFlags(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.from('feature_flags').select('key, enabled')
  if (error) throw error
  const map: Record<string, boolean> = {}
  for (const row of data ?? []) map[(row as { key: string }).key] = (row as { enabled: boolean }).enabled
  cache = map
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map)).catch(() => {})
  return map
}

/** Shared between callers, so ten components asking cost one request. */
function loadFlags(): Promise<Record<string, boolean>> {
  if (cache) return Promise.resolve(cache)
  if (!inFlight) {
    inFlight = fetchFlags().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

export function useFeatureFlag(key: FeatureKey): boolean {
  const [enabled, setEnabled] = useState(cache ? (cache[key] ?? true) : true)

  useEffect(() => {
    let cancelled = false

    if (!cache) {
      AsyncStorage.getItem(CACHE_KEY)
        .then((raw) => {
          if (cancelled || !raw) return
          const stored = JSON.parse(raw) as Record<string, boolean>
          if (!cache) setEnabled(stored[key] ?? true)
        })
        .catch(() => {})
    }

    loadFlags()
      .then((flags) => {
        if (!cancelled) setEnabled(flags[key] ?? true)
      })
      .catch(() => {
        // Fail open. See above.
      })

    return () => {
      cancelled = true
    }
  }, [key])

  return enabled
}

/** Forget the cached answer, so the next read goes to the database. */
export function refreshFeatureFlags(): void {
  cache = null
}
