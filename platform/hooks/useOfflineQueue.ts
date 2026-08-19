import { useCallback, useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { offlineQueueAvailable, readQueue, stuck, type QueuedItem } from '@/lib/offlineQueue'
import { syncOfflineQueue } from '@/lib/offlineSync'

export interface OfflineQueueState {
  online: boolean
  items: QueuedItem[]
  /** Items that have failed too often to keep retrying. They need her attention. */
  needsAttention: QueuedItem[]
  syncing: boolean
  refresh: () => void
  syncNow: () => void
}

/**
 * The offline queue, and the connection it is waiting for (§8.19).
 *
 * Flushes automatically the moment signal returns, which is the whole point —
 * a creator who has to remember to press "sync" is a creator whose deal sits in
 * a queue until she notices, and the promise was that she never sees a failure
 * at all.
 */
export function useOfflineQueue(): OfflineQueueState {
  const [online, setOnline] = useState(true)
  const [items, setItems] = useState<QueuedItem[]>([])
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    setItems(await readQueue())
  }, [])

  const syncNow = useCallback(async () => {
    if (!offlineQueueAvailable() || syncing) return
    setSyncing(true)
    try {
      await syncOfflineQueue()
    } finally {
      setSyncing(false)
      await refresh()
    }
  }, [refresh, syncing])

  useEffect(() => {
    refresh()
    if (!offlineQueueAvailable()) return

    let wasOnline = true
    const unsubscribe = NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null while it is still being determined.
      // Treating unknown as offline would queue writes that would have
      // succeeded, so it only counts as offline once it is definitively false.
      const nowOnline = !!state.isConnected && state.isInternetReachable !== false
      setOnline(nowOnline)

      // Only on the transition. A listener that fired a flush on every network
      // event would start one per Wi-Fi signal fluctuation.
      if (nowOnline && !wasOnline) syncNow()
      wasOnline = nowOnline
    })

    return unsubscribe
  }, [refresh, syncNow])

  return { online, items, needsAttention: stuck(items), syncing, refresh, syncNow }
}
