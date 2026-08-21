import { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from '@react-navigation/core'
import {
  getTicket,
  replyToTicket,
  updateTicket,
  type SupportTicket,
  type TicketNote,
  type TicketStatus,
} from '@/lib/admin'
import { formatDateLong } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { Button, Card, Chip, SegmentedControl, TextField, useToast } from '@/components/ui'

/**
 * One conversation.
 *
 * Two kinds of message in one thread: a reply the creator sees, and a note
 * only this screen does. One thread because the order things happened in is
 * what makes it readable, and an internal note usually explains the reply that
 * follows it.
 */
export default function TicketScreen() {
  const { c } = useTheme()
  const toast = useToast()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [notes, setNotes] = useState<TicketNote[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [internal, setInternal] = useState(false)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const data = await getTicket(String(id))
      setTicket(data.ticket)
      setNotes(data.notes)
    } catch {
      toast('Could not open that ticket', { tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const send = async () => {
    if (!draft.trim() || !ticket) return
    setSending(true)
    try {
      await replyToTicket(ticket.id, draft.trim(), internal)
      setDraft('')
      toast(internal ? 'Note added' : 'Reply sent')
      load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not send', { tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  const setStatus = async (status: TicketStatus) => {
    if (!ticket) return
    try {
      await updateTicket(ticket.id, { status })
      load()
    } catch {
      toast('That did not change', { tone: 'error' })
    }
  }

  const setPriority = async (priority: string) => {
    if (!ticket) return
    try {
      await updateTicket(ticket.id, { priority })
      load()
    } catch {
      toast('That did not change', { tone: 'error' })
    }
  }

  return (
    <AdminScreen
      title={ticket?.subject ?? 'Ticket'}
      hint={
        ticket
          ? `${ticket.email ?? 'Unknown sender'} · ${formatDateLong(ticket.created_at)}`
          : undefined
      }
      loading={loading}
    >
      {!ticket ? null : (
        <>
          <View style={styles.controls}>
            <SegmentedControl
              options={[
                { key: 'new', label: 'New' },
                { key: 'open', label: 'On you' },
                { key: 'waiting', label: 'On them' },
                { key: 'closed', label: 'Closed' },
              ]}
              value={ticket.status}
              onChange={(value) => setStatus(value as TicketStatus)}
            />
            <View style={styles.priority}>
              {['low', 'normal', 'high'].map((level) => (
                <Chip
                  key={level}
                  label={level === 'high' ? 'Urgent' : level}
                  selected={ticket.priority === level}
                  onPress={() => setPriority(level)}
                  size="sm"
                  tone={level === 'high' ? 'danger' : 'neutral'}
                />
              ))}
            </View>
          </View>

          <Card>
            <Text style={[styles.author, { color: c.textMuted }]}>
              {ticket.email ?? 'They'} wrote
            </Text>
            <Text style={[styles.body, { color: c.textPrimary }]}>{ticket.body}</Text>
          </Card>

          {notes.map((note) => (
            <Card
              key={note.id}
              style={note.is_internal ? { backgroundColor: c.warningLight } : undefined}
            >
              <Text
                style={[styles.author, { color: note.is_internal ? c.warning : c.textMuted }]}
              >
                {note.is_internal ? 'Internal note' : 'Reply'} ·{' '}
                {formatDateLong(note.created_at)}
              </Text>
              <Text
                style={[styles.body, { color: note.is_internal ? c.warning : c.textPrimary }]}
              >
                {note.body}
              </Text>
            </Card>
          ))}

          <TextField
            label={internal ? 'A note only you can see' : 'Your reply'}
            placeholder={
              internal ? 'What you worked out, for next time' : 'Write back to them here'
            }
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <View style={styles.send}>
            <Chip
              label="Keep this private"
              icon={internal ? 'lock-closed' : 'lock-open-outline'}
              selected={internal}
              onPress={() => setInternal((value) => !value)}
              size="sm"
            />
            <Button
              label={sending ? 'Sending' : internal ? 'Add the note' : 'Send the reply'}
              onPress={send}
              disabled={sending || !draft.trim()}
              size="sm"
            />
          </View>

          <Text style={[styles.footnote, { color: c.textMuted }]}>
            A private note never leaves this screen. A reply is visible to whoever wrote in.
          </Text>
        </>
      )}
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  controls: { gap: Spacing.sm },
  priority: { flexDirection: 'row', gap: Spacing.xs },
  author: { ...Typography.label, fontFamily: FontFamily.medium, marginBottom: 4 },
  body: { ...Typography.body, fontFamily: FontFamily.regular, lineHeight: 22 },
  send: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  footnote: { ...Typography.caption, fontFamily: FontFamily.regular, lineHeight: 18 },
})
