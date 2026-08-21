import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/core'
import { listDataRequests, updateDataRequest, type DataRequest } from '@/lib/admin'
import { formatDateLong, daysFromToday } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { EmptyState, ListRow, OverflowMenu, useToast } from '@/components/ui'

/**
 * The register of data requests, under the DPDP Act.
 *
 * Not a feature so much as an obligation. The product could already export
 * everything and delete an account; what never existed was a record that
 * somebody asked, and when they were answered. A regulator asking "show me"
 * is not a moment to be reconstructing it from memory.
 *
 * Thirty days is the clock, stored on each row rather than computed, so that
 * changing the policy later does not silently move the deadline on a request
 * somebody already made.
 */
export default function AdminDataRequests() {
  const { c } = useTheme()
  const toast = useToast()

  const [requests, setRequests] = useState<DataRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { rows } = await listDataRequests()
      setRequests(rows)
    } catch {
      toast('Could not load the register', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const move = async (request: DataRequest, status: string) => {
    try {
      await updateDataRequest(request.id, { status })
      toast('Updated')
      load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not work', { tone: 'error' })
    }
  }

  const outstanding = requests.filter((r) => r.status === 'new' || r.status === 'in_progress')

  return (
    <AdminScreen
      title="Data requests"
      hint={
        outstanding.length === 0
          ? 'Nothing outstanding. Requests appear here the moment somebody makes one.'
          : `${outstanding.length} still to answer.`
      }
      loading={loading}
    >
      {requests.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="Nobody has asked"
          message="A creator asking for a copy of their data, or for it to be erased, lands here with a thirty day clock on it."
        />
      ) : (
        <View style={styles.rows}>
          {requests.map((request, index) => {
            const days = daysFromToday(request.due_at)
            const late = days < 0 && request.status !== 'done' && request.status !== 'refused'
            return (
              <ListRow
                key={request.id}
                title={request.kind === 'access' ? 'A copy of their data' : 'Erase their data'}
                subtitle={request.email ?? 'Unknown'}
                meta={
                  request.completed_at
                    ? `Answered ${formatDateLong(request.completed_at)}`
                    : late
                      ? `Overdue by ${Math.abs(days)} days`
                      : `Due ${formatDateLong(request.due_at)}`
                }
                metaColor={late ? c.danger : undefined}
                trailing={
                  <View style={styles.trailing}>
                    <View
                      style={[
                        styles.pill,
                        // bgSurfaceRaised, not bgSurface: the row underneath is
                        // already bgSurface, so a pill in the same colour was
                        // invisible and read as loose text.
                        { backgroundColor: late ? c.dangerLight : c.bgSurfaceRaised },
                      ]}
                    >
                      <Text
                        style={[styles.pillText, { color: late ? c.danger : c.textSecondary }]}
                      >
                        {request.status.replace('_', ' ')}
                      </Text>
                    </View>
                    <OverflowMenu
                      subject={request.email ?? 'Request'}
                      actions={[
                        {
                          label: 'Working on it',
                          icon: 'time-outline',
                          onPress: () => move(request, 'in_progress'),
                        },
                        {
                          label: 'Answered',
                          icon: 'checkmark-circle-outline',
                          onPress: () => move(request, 'done'),
                        },
                        {
                          label: 'Refused',
                          icon: 'close-circle-outline',
                          onPress: () => move(request, 'refused'),
                          destructive: true,
                        },
                      ]}
                    />
                  </View>
                }
                index={index}
              />
            )
          })}
        </View>
      )}
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  rows: { gap: Spacing.sm },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  pill: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  pillText: { ...Typography.label, fontFamily: FontFamily.semiBold, textTransform: 'capitalize' },
})
