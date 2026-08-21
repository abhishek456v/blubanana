import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/core'
import {
  CHANNEL_NAMES,
  PLATFORM_NAMES,
  PURPOSE_NAMES,
  REMINDER_TYPE_NAMES,
  getAdminHealth,
  healthIssueCount,
  nameFor,
  type AdminHealth,
} from '@/lib/admin'
import { formatDateLong, formatRelativeDay } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { Card, EmptyState, ListRow, useToast } from '@/components/ui'

/**
 * The three things that fail quietly.
 *
 * Every one of them was already being recorded and none was being watched, so
 * the first anyone heard about a failure was a creator asking why her figures
 * had stopped moving. The dashboard shows a count; this says which, whose, and
 * when.
 */
export default function AdminHealthScreen() {
  const { c } = useTheme()
  const toast = useToast()

  const [health, setHealth] = useState<AdminHealth | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setHealth(await getAdminHealth())
    } catch {
      toast('Could not load the health check', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const issues = health ? healthIssueCount(health) : 0
  const nameOf = (id: string) => health?.workspaceNames[id] ?? 'Unknown workspace'

  return (
    <AdminScreen
      title="What is broken"
      hint={
        issues === 0
          ? 'Connections, reminders and messages are all behaving.'
          : `${issues} ${issues === 1 ? 'thing needs' : 'things need'} attention.`
      }
      loading={loading}
    >
      {!health ? null : issues === 0 ? (
        <EmptyState
          icon="checkmark-circle-outline"
          title="Nothing is broken"
          message="No expired connections, no missed reminders, nothing stuck in the outbox."
        />
      ) : (
        <>
          <Section
            title="Connections that stopped working"
            hint="A creator's figures freeze the moment this happens, and nothing tells her."
            count={health.socialAccounts.length}
          >
            {health.socialAccounts.map((account, index) => (
              <ListRow
                key={account.id}
                title={`${nameFor(PLATFORM_NAMES, account.platform)} · ${account.handle}`}
                subtitle={nameOf(account.workspace_id)}
                meta={
                  account.last_error ??
                  (account.last_synced_at
                    ? `Last worked ${formatRelativeDay(account.last_synced_at)}`
                    : 'Never synced')
                }
                metaColor={c.danger}
                // Two lines: this is the error, which is the whole reason the
                // row is here, and one line cut it off mid-sentence.
                metaLines={2}
                trailing={<Pill label={statusWord(account.status, 'connection')} tone="danger" />}
                index={index}
              />
            ))}
          </Section>

          <Section
            title="Reminders that passed without anybody acting"
            hint="Expired or escalated. Each one is a nudge a creator was expecting and did not get."
            count={health.missedReminders.length}
          >
            {health.missedReminders.slice(0, 25).map((reminder, index) => (
              <ListRow
                key={reminder.id}
                // The reminder's own title, not its type. "payment" is a
                // database value; "Chase the Nykaa payment" is the thing that
                // did not happen.
                title={reminder.title || nameFor(REMINDER_TYPE_NAMES, reminder.type)}
                subtitle={`${nameFor(REMINDER_TYPE_NAMES, reminder.type)} · ${nameOf(reminder.workspace_id)}`}
                meta={`Was due ${formatRelativeDay(reminder.scheduled_for)}`}
                trailing={<Pill label={statusWord(reminder.status, 'reminder')} tone="warning" />}
                index={index}
              />
            ))}
          </Section>

          <Section
            title="Messages cleared to send that never went"
            hint="Approved and still sitting there. Draft and cancelled are deliberate and not listed."
            count={health.stuckMessages.length}
          >
            {health.stuckMessages.slice(0, 25).map((message, index) => (
              <ListRow
                key={message.id}
                title={nameFor(PURPOSE_NAMES, message.purpose)}
                subtitle={`${nameFor(CHANNEL_NAMES, message.channel)}${message.recipient ? ` to ${message.recipient}` : ''} · ${nameOf(message.workspace_id)}`}
                meta={`Waiting since ${formatDateLong(message.created_at)}`}
                trailing={<Pill label={statusWord(message.status, 'message')} tone="warning" />}
                index={index}
              />
            ))}
          </Section>
        </>
      )}
    </AdminScreen>
  )
}

function Section({
  title,
  hint,
  count,
  children,
}: {
  title: string
  hint: string
  count: number
  children: React.ReactNode
}) {
  const { c } = useTheme()
  if (count === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>{title}</Text>
        <Text style={[styles.sectionCount, { color: c.textMuted }]}>{count}</Text>
      </View>
      <Text style={[styles.sectionHint, { color: c.textSecondary }]}>{hint}</Text>
      <View style={styles.rows}>{children}</View>
      {count > 25 ? (
        <Text style={[styles.more, { color: c.textMuted }]}>
          Showing the first 25 of {count}.
        </Text>
      ) : null}
    </View>
  )
}

/**
 * The status, said as what went wrong rather than as what the column holds.
 *
 * Two of these tables use the word "expired" for different things, which is
 * why the subject has to be passed in: a reminder that expired was *missed*,
 * and a connection that expired has simply *expired* and needs renewing.
 * Calling a dead Instagram connection "Missed" is wrong, and it was, until
 * somebody looked at the screen.
 *
 * "approved" is the one that matters most. On a list headed "messages that
 * never went", a word that sounds like success beside a message is the
 * opposite of the truth: it means cleared to send and still sitting there.
 */
function statusWord(status: string, about: 'connection' | 'reminder' | 'message'): string {
  if (about === 'reminder' && status === 'expired') return 'Missed'
  if (about === 'message' && status === 'approved') return 'Not sent'
  if (status === 'escalated') return 'Escalated'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function Pill({ label, tone }: { label: string; tone: 'danger' | 'warning' }) {
  const { c } = useTheme()
  const bg = tone === 'danger' ? c.dangerLight : c.warningLight
  const fg = tone === 'danger' ? c.danger : c.warning
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: Spacing.xs, marginTop: Spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  sectionTitle: { ...Typography.heading, fontFamily: FontFamily.semiBold, flex: 1 },
  sectionCount: { ...Typography.caption, fontFamily: FontFamily.medium },
  sectionHint: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 18 },
  rows: { gap: Spacing.sm, marginTop: Spacing.xs },
  more: { ...Typography.caption, fontFamily: FontFamily.regular, marginTop: Spacing.xs },
  pill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  pillText: { ...Typography.label, fontFamily: FontFamily.semiBold },
})
