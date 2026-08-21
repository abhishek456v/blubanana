import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import { listTickets, type SupportTicket, type TicketStatus } from '@/lib/admin'
import { formatRelativeDay } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { Chip, EmptyState, ListRow, useToast } from '@/components/ui'

type Filter = 'open' | 'all' | TicketStatus

/**
 * What people have written in about.
 *
 * "Open" means anything not finished, which is three of the four statuses. A
 * filter that hides the new ones would be the opposite of useful.
 */
export default function AdminSupport() {
  const { c } = useTheme()
  const router = useRouter()
  const toast = useToast()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('open')

  const load = useCallback(async () => {
    try {
      const { rows, workspaceNames } = await listTickets(filter)
      setTickets(rows)
      setNames(workspaceNames)
    } catch {
      toast('Could not load the tickets', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const waitingOnUs = tickets.filter((t) => t.status === 'new' || t.status === 'open').length

  return (
    <AdminScreen
      title="Help"
      hint={
        waitingOnUs === 0
          ? 'Nobody is waiting on a reply.'
          : `${waitingOnUs} waiting on a reply from you.`
      }
      loading={loading}
    >
      <View style={styles.filters}>
        {(
          [
            ['open', 'Open'],
            ['new', 'New'],
            ['waiting', 'Waiting on them'],
            ['closed', 'Closed'],
            ['all', 'Everything'],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={filter === key}
            onPress={() => setFilter(key)}
            size="sm"
          />
        ))}
      </View>

      {tickets.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="Nothing here"
          message="No ticket matches that filter."
        />
      ) : (
        <View style={styles.rows}>
          {tickets.map((ticket, index) => (
            <ListRow
              key={ticket.id}
              title={ticket.subject}
              subtitle={
                ticket.email ??
                (ticket.workspace_id ? names[ticket.workspace_id] : undefined) ??
                'Unknown sender'
              }
              meta={formatRelativeDay(ticket.created_at)}
              trailing={<StatusPill status={ticket.status} priority={ticket.priority} />}
              onPress={() => router.push(`/admin/ticket/${ticket.id}` as never)}
              showChevron
              index={index}
            />
          ))}
        </View>
      )}
    </AdminScreen>
  )
}

function StatusPill({ status, priority }: { status: TicketStatus; priority: string }) {
  const { c } = useTheme()
  const tone =
    status === 'new'
      ? { bg: c.accentLight, fg: c.accentText, label: 'New' }
      : status === 'open'
        ? { bg: c.warningLight, fg: c.warning, label: 'On you' }
        : status === 'waiting'
          ? { bg: c.bgSurface, fg: c.textMuted, label: 'On them' }
          : { bg: c.successLight, fg: c.success, label: 'Closed' }

  return (
    <View style={styles.pills}>
      {priority === 'high' ? (
        <View style={[styles.pill, { backgroundColor: c.dangerLight }]}>
          <Text style={[styles.pillText, { color: c.danger }]}>Urgent</Text>
        </View>
      ) : null}
      <View style={[styles.pill, { backgroundColor: tone.bg }]}>
        <Text style={[styles.pillText, { color: tone.fg }]}>{tone.label}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  rows: { gap: Spacing.sm },
  pills: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  pill: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  pillText: { ...Typography.label, fontFamily: FontFamily.semiBold },
})
