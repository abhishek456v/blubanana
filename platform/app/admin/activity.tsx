import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/core'
import { getAdminActivity, type ActivityEntry } from '@/lib/admin'
import { formatDateLong } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { Chip, EmptyState, ListRow, useToast } from '@/components/ui'

/**
 * What has been happening, from the log that was filling up all along.
 *
 * `audit_logs` had hundreds of rows in it before anything could read them.
 * This is a screen over data that already existed, which is the cheapest kind
 * of feature there is.
 */
export default function AdminActivity() {
  const { c } = useTheme()
  const toast = useToast()

  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [actors, setActors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<string>('all')

  const load = useCallback(async () => {
    try {
      const data = await getAdminActivity()
      setEntries(data.rows)
      setNames(data.workspaceNames)
      setActors(data.actorNames)
    } catch {
      toast('Could not load the activity', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const kinds = useMemo(
    () => ['all', ...new Set(entries.map((entry) => entry.entity_type))],
    [entries]
  )

  const shown = entries.filter((entry) => kind === 'all' || entry.entity_type === kind)

  return (
    <AdminScreen
      title="Activity"
      hint="The last 200 things anybody did, across every workspace."
      loading={loading}
    >
      <View style={styles.filters}>
        {kinds.map((value) => (
          <Chip
            key={value}
            label={value === 'all' ? 'Everything' : value}
            selected={kind === value}
            onPress={() => setKind(value)}
            size="sm"
          />
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon="pulse-outline"
          title="Nothing recorded"
          message="No activity of that kind yet."
        />
      ) : (
        <View style={styles.rows}>
          {shown.map((entry, index) => (
            <ListRow
              key={entry.id}
              title={`${sentence(entry)}`}
              subtitle={names[entry.workspace_id] ?? 'Unknown workspace'}
              meta={`${entry.actor_user_id ? (actors[entry.actor_user_id] ?? 'Somebody') : 'The system'} · ${formatDateLong(entry.created_at)}`}
              index={index}
            />
          ))}
        </View>
      )}
    </AdminScreen>
  )
}

/** "Added a deal" rather than "deal / create". A log nobody can read is a file. */
function sentence(entry: ActivityEntry): string {
  const verb =
    entry.action === 'create'
      ? 'Added'
      : entry.action === 'update'
        ? 'Changed'
        : entry.action === 'delete'
          ? 'Deleted'
          : entry.action
  return `${verb} a ${entry.entity_type}`
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  rows: { gap: Spacing.sm },
})
