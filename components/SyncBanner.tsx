import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { offlineQueueAvailable } from '@/lib/offlineQueue'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { PressableScale } from '@/components/ui'

/**
 * What is waiting for signal (§8.19).
 *
 * Shows nothing when there is nothing to say — which is almost always. A
 * permanent connection indicator trains people to ignore it, and the one moment
 * this matters is the moment it appears.
 *
 * Never phrased as an error. §8.19's promise is that she never sees a failure,
 * and "saved, waiting for signal" is the truth: the capture is on her device
 * and will land. Calling that a failure would make her retype it.
 */
export function SyncBanner() {
  const { c } = useTheme()
  const { online, items, needsAttention, syncing, syncNow } = useOfflineQueue()

  if (!offlineQueueAvailable()) return null
  if (items.length === 0 && online) return null

  if (needsAttention.length > 0) {
    return (
      <PressableScale
        onPress={syncNow}
        accessibilityRole="button"
        accessibilityLabel="Retry the items that could not sync"
        style={[styles.row, { backgroundColor: c.dangerLight }]}
      >
        <Ionicons name="alert-circle-outline" size={16} color={c.danger} />
        <Text style={[styles.text, { color: c.textPrimary }]} numberOfLines={2}>
          {needsAttention.length} {needsAttention.length === 1 ? 'capture' : 'captures'} could not
          be saved — {needsAttention[0].lastError ?? 'tap to try again'}
        </Text>
      </PressableScale>
    )
  }

  if (items.length === 0) return null

  return (
    <PressableScale
      onPress={online ? syncNow : undefined}
      disabled={!online}
      accessibilityRole={online ? 'button' : 'text'}
      accessibilityLabel={
        online ? 'Sync what is waiting' : `${items.length} captures waiting for signal`
      }
      style={[styles.row, { backgroundColor: c.accentLight }]}
    >
      <Ionicons
        name={online ? 'cloud-upload-outline' : 'cloud-offline-outline'}
        size={16}
        color={c.accent}
      />
      <Text style={[styles.text, { color: c.accentText }]} numberOfLines={2}>
        {syncing
          ? 'Syncing…'
          : online
            ? `${items.length} waiting to sync · tap to send now`
            : `Saved on this phone · ${items.length} will sync when you have signal`}
      </Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  text: {
    ...Typography.caption,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
})
