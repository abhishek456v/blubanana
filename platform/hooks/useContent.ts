import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'

const CACHE_KEY = 'blubanana.copy'

/**
 * Copy that can be reworded from the dashboard, with the shipped words as the
 * fallback.
 *
 * ── Why the fallback is a required argument ─────────────────────────────────
 *
 * `useContent('onboarding.you.title', 'Tell brands who you are')` reads oddly
 * next to a plain string, and it is the reason this cannot show an empty
 * screen. No row, no signal, first launch before anything has been fetched:
 * all of them render the sentence that shipped. A content system that can
 * blank a heading is worse than no content system.
 *
 * The cached copy paints immediately and the fresh copy replaces it a moment
 * later, so nothing arrives visibly late.
 */
let cache: Record<string, string> | null = null
let inFlight: Promise<Record<string, string>> | null = null

async function fetchCopy(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('site_content').select('key, value').eq('area', 'app')
  if (error) throw error

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[(row as { key: string }).key] = (row as { value: string }).value
  }
  cache = map
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map)).catch(() => {})
  return map
}

function loadCopy(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache)
  if (!inFlight) {
    inFlight = fetchCopy().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

export function useContent(key: string, fallback: string): string {
  const [value, setValue] = useState(cache?.[key] ?? fallback)

  useEffect(() => {
    let cancelled = false

    if (!cache) {
      AsyncStorage.getItem(CACHE_KEY)
        .then((raw) => {
          if (cancelled || !raw || cache) return
          const stored = JSON.parse(raw) as Record<string, string>
          if (stored[key]) setValue(stored[key])
        })
        .catch(() => {})
    }

    loadCopy()
      .then((copy) => {
        if (!cancelled) setValue(copy[key]?.trim() || fallback)
      })
      .catch(() => {
        // The shipped words stand.
      })

    return () => {
      cancelled = true
    }
  }, [key, fallback])

  return value
}

/** Forget the cached copy, so the next read goes to the database. */
export function refreshContent(): void {
  cache = null
}
