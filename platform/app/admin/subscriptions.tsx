import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/core'
import {
  adjustSubscription,
  getAdminSubscriptions,
  type AdminSubscription,
  type SubscriptionLever,
} from '@/lib/admin'
import { formatCurrency, formatDate, formatRelativeDay } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { AdminScreen } from '@/components/admin/AdminScreen'
import {
  Chip,
  DataTable,
  EmptyState,
  ListRow,
  MetricCard,
  OverflowMenu,
  useConfirm,
  useToast,
} from '@/components/ui'

type Filter = 'all' | 'trialing' | 'active' | 'ending'

/** Paise to rupees. The subscription tables are the only ones that use paise. */
const rupees = (paise: number) => Math.round(paise / 100)

/**
 * Who is paying, who is about to stop, and the four levers.
 *
 * The levers are the point. A creator whose card failed on the day of a shoot
 * does not want a refund policy, she wants it to keep working while she sorts
 * it out, and the difference between a good week and a bad one is whether that
 * takes a click or a database console.
 */
export default function AdminSubscriptions() {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState<AdminSubscription[]>([])
  const [collected, setCollected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    try {
      const { rows: list, collectedPaise } = await getAdminSubscriptions()
      setRows(list)
      setCollected(collectedPaise)
    } catch {
      toast('Could not load subscriptions', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  /** Ending within the week, whether that is a trial or a paid period. */
  const endsSoon = (row: AdminSubscription) => {
    const end = row.status === 'trialing' ? row.trial_ends_at : row.current_period_end
    if (!end) return false
    const days = (new Date(end).getTime() - Date.now()) / 86_400_000
    return days <= 7
  }

  const shown = useMemo(() => {
    return rows.filter((row) => {
      if (filter === 'trialing') return row.status === 'trialing'
      if (filter === 'active') return row.status === 'active'
      if (filter === 'ending') return endsSoon(row)
      return true
    })
  }, [rows, filter])

  const pull = useCallback(
    async (row: AdminSubscription, lever: SubscriptionLever, days?: number) => {
      const wording: Record<SubscriptionLever, string> = {
        extend_trial: `Give ${row.workspace_name} another ${days} days of trial?`,
        comp_month: `Give ${row.workspace_name} ${days} days on the house?`,
        uncancel: `Put ${row.workspace_name} back on their subscription?`,
        set_status: `Change what ${row.workspace_name} is marked as?`,
      }
      const ok = await confirm({
        title: wording[lever],
        message: 'This changes what they can do in the app straight away, and is recorded.',
        confirmLabel: 'Do it',
      })
      if (!ok) return

      try {
        await adjustSubscription({ workspace_id: row.workspace_id, lever, days })
        toast('Done')
        load()
      } catch (error) {
        toast(error instanceof Error ? error.message : 'That did not work', { tone: 'error' })
      }
    },
    [confirm, load, toast]
  )

  const menuFor = (row: AdminSubscription) => (
    <OverflowMenu
      subject={row.workspace_name}
      actions={[
        {
          label: 'Add 14 days of trial',
          icon: 'time-outline',
          onPress: () => pull(row, 'extend_trial', 14),
          // Greyed rather than hidden, with the reason, because the question
          // "why can I not extend this one" deserves an answer on the screen.
          disabledReason:
            row.status === 'active' || row.status === 'past_due'
              ? 'They are paying. A trial would take features away'
              : undefined,
        },
        {
          label: 'A month on the house',
          icon: 'gift-outline',
          onPress: () => pull(row, 'comp_month', 30),
        },
        {
          label: 'Undo the cancellation',
          icon: 'arrow-undo-outline',
          onPress: () => pull(row, 'uncancel'),
          disabledReason: row.cancelled_at ? undefined : 'This one is not cancelled',
        },
      ]}
    />
  )

  const counts = {
    paying: rows.filter((r) => r.status === 'active').length,
    trialing: rows.filter((r) => r.status === 'trialing').length,
    ending: rows.filter(endsSoon).length,
  }

  return (
    <AdminScreen
      title="Subscriptions"
      hint="Everything that has been collected, and the levers for putting something right."
      loading={loading}
    >
      <View style={styles.metrics}>
        <View style={styles.cell}>
          <MetricCard
            label="Collected"
            value={rupees(collected)}
            format={formatCurrency}
            tone="accent"
            caption="all time, from payments received"
            index={0}
          />
        </View>
        <View style={styles.cell}>
          <MetricCard label="Paying" value={counts.paying} index={1} />
        </View>
        <View style={styles.cell}>
          <MetricCard label="On trial" value={counts.trialing} index={2} />
        </View>
        <View style={styles.cell}>
          <MetricCard
            label="Ending this week"
            value={counts.ending}
            caption="trial or paid period"
            index={3}
          />
        </View>
      </View>

      <View style={styles.filters}>
        {(
          [
            ['all', 'Everyone'],
            ['trialing', 'On trial'],
            ['active', 'Paying'],
            ['ending', 'Ending this week'],
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

      {shown.length === 0 ? (
        <EmptyState
          icon="card-outline"
          title="Nothing here"
          message="No subscription matches that filter."
        />
      ) : isDesktop ? (
        <DataTable
          columns={[
            {
              key: 'name',
              title: 'Workspace',
              flex: 2,
              render: (row: AdminSubscription) => row.workspace_name,
            },
            {
              key: 'status',
              title: 'Status',
              flex: 1,
              render: (row: AdminSubscription) => (
                <Text style={[styles.status, { color: colourFor(row.status, c) }]}>
                  {label(row.status)}
                </Text>
              ),
            },
            {
              key: 'term',
              title: 'Term',
              flex: 0.9,
              // "None" rather than an empty cell: a blank in a table reads as
              // a bug, and nobody has chosen a term until they pay.
              render: (row: AdminSubscription) => row.billing_term ?? 'None',
            },
            {
              key: 'ends',
              title: 'Runs to',
              flex: 1.1,
              render: (row: AdminSubscription) =>
                formatDate(
                  row.status === 'trialing' ? row.trial_ends_at : row.current_period_end
                ) || 'No end date',
            },
            {
              key: 'paid',
              title: 'Paid',
              flex: 1,
              align: 'right',
              render: (row: AdminSubscription) => formatCurrency(rupees(row.paid_total_paise)),
            },
            {
              key: 'menu',
              title: '',
              flex: 0.4,
              align: 'right',
              render: (row: AdminSubscription) => menuFor(row),
            },
          ]}
          rows={shown}
          keyOf={(row) => row.workspace_id}
        />
      ) : (
        <View style={styles.rows}>
          {shown.map((row, index) => (
            <ListRow
              key={row.workspace_id}
              title={row.workspace_name}
              subtitle={`${label(row.status)} · ${row.billing_term ?? 'no term yet'}`}
              meta={
                row.status === 'trialing'
                  ? `Trial ends ${formatRelativeDay(row.trial_ends_at)}`
                  : row.current_period_end
                    ? `Runs to ${formatDate(row.current_period_end)}`
                    : 'No end date'
              }
              trailing={menuFor(row)}
              index={index}
            />
          ))}
        </View>
      )}
    </AdminScreen>
  )
}

function label(status: string): string {
  if (status === 'active') return 'Paying'
  if (status === 'trialing') return 'On trial'
  if (status === 'past_due') return 'Payment late'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

function colourFor(status: string, c: ReturnType<typeof useTheme>['c']): string {
  if (status === 'active') return c.success
  if (status === 'past_due') return c.danger
  if (status === 'trialing') return c.accentText
  return c.textSecondary
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'flex-start' },
  cell: { flexGrow: 1, flexBasis: 180 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  rows: { gap: Spacing.sm },
  status: { ...Typography.caption, fontFamily: FontFamily.semiBold },
})
