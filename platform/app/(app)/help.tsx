import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/core'
import { Ionicons } from '@expo/vector-icons'
import {
  fileDataRequest,
  getMyDataRequests,
  getMyTicketNotes,
  getMyTickets,
  raiseTicket,
  replyOnMyTicket,
  type MyTicket,
  type MyTicketNote,
} from '@/lib/support'
import { formatDateLong, formatRelativeDay } from '@/lib/format'
import {
  DesktopContentMaxWidth,
  FontFamily,
  Radius,
  Spacing,
  Typography,
} from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { Button, Card, ListRow, Sheet, TextField, useConfirm, useToast } from '@/components/ui'

/**
 * Writing in, and hearing back.
 *
 * The product had no way to ask for help that was not an email address on the
 * website, which meant every question arrived without any idea of who was
 * asking or what they were looking at.
 *
 * The data requests at the bottom are here rather than in Settings because
 * both are the same act: asking a person for something. Settings is where you
 * change your own things.
 */
export default function HelpScreen() {
  const { c } = useTheme()
  const { isDesktop } = useBreakpoint()
  const toast = useToast()
  const confirm = useConfirm()

  const [tickets, setTickets] = useState<MyTicket[]>([])
  const [requests, setRequests] = useState<
    { id: string; kind: string; status: string; created_at: string; due_at: string }[]
  >([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const [openTicket, setOpenTicket] = useState<MyTicket | null>(null)
  const [notes, setNotes] = useState<MyTicketNote[]>([])
  const [reply, setReply] = useState('')

  const load = useCallback(async () => {
    try {
      const [mine, asked] = await Promise.all([getMyTickets(), getMyDataRequests()])
      setTickets(mine)
      setRequests(asked)
    } catch {
      // Non-fatal: the form still works, which is the part that matters when
      // somebody has come here because something is wrong.
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast('A subject and a sentence or two, please', { tone: 'error' })
      return
    }
    setSending(true)
    try {
      await raiseTicket({ subject, body })
      setSubject('')
      setBody('')
      toast('Sent. We will write back.')
      load()
    } catch {
      toast('That did not send. Try again in a moment.', { tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  const open = async (ticket: MyTicket) => {
    setOpenTicket(ticket)
    setNotes(await getMyTicketNotes(ticket.id).catch(() => []))
  }

  const sendReply = async () => {
    if (!openTicket || !reply.trim()) return
    try {
      await replyOnMyTicket(openTicket.id, reply)
      setReply('')
      setNotes(await getMyTicketNotes(openTicket.id))
      load()
    } catch {
      toast('That did not send', { tone: 'error' })
    }
  }

  const ask = async (kind: 'access' | 'erasure') => {
    const ok = await confirm({
      title:
        kind === 'access'
          ? 'Ask for a copy of your data?'
          : 'Ask for your data to be erased?',
      message:
        kind === 'access'
          ? 'You can already export everything yourself from Settings, straight away. This puts a formal request on record, answered within thirty days.'
          : 'This is a formal request, answered within thirty days. Deleting your account from Settings does it immediately instead.',
      confirmLabel: 'Send the request',
    })
    if (!ok) return

    try {
      await fileDataRequest(kind)
      toast('Recorded. We will be in touch.')
      load()
    } catch {
      toast('That did not send', { tone: 'error' })
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgPage }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, isDesktop && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <Text style={[styles.cardTitle, { color: c.textPrimary }]}>What is going on</Text>
          <Text style={[styles.cardHint, { color: c.textSecondary }]}>
            Tell us what happened and what you expected instead. A screenshot helps, and you can
            send that to the email address on the website.
          </Text>
          <View style={styles.form}>
            <TextField
              label="Subject"
              placeholder="A payment is showing twice"
              value={subject}
              onChangeText={setSubject}
            />
            <TextField
              label="What happened"
              placeholder="I marked the Nykaa payment as received and it now shows in both lists."
              value={body}
              onChangeText={setBody}
              multiline
            />
            <Button
              label={sending ? 'Sending' : 'Send'}
              onPress={send}
              disabled={sending}
              fullWidth
            />
          </View>
        </Card>

        {tickets.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
              What you have asked
            </Text>
            <View style={styles.rows}>
              {tickets.map((ticket, index) => (
                <ListRow
                  key={ticket.id}
                  title={ticket.subject}
                  subtitle={
                    ticket.status === 'closed'
                      ? 'Closed'
                      : ticket.status === 'waiting'
                        ? 'Waiting on you'
                        : 'With us'
                  }
                  meta={formatRelativeDay(ticket.created_at)}
                  onPress={() => open(ticket)}
                  showChevron
                  index={index}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Your data</Text>
        <Card>
          <Text style={[styles.cardHint, { color: c.textSecondary }]}>
            You can export everything, or delete your account, from Settings whenever you like.
            These two put a formal request on record instead, which we answer within thirty days.
          </Text>
          <View style={styles.dataActions}>
            <Button
              label="Ask for a copy"
              variant="secondary"
              size="sm"
              onPress={() => ask('access')}
            />
            <Button
              label="Ask for erasure"
              variant="secondary"
              size="sm"
              onPress={() => ask('erasure')}
            />
          </View>
          {requests.map((request) => (
            <Text key={request.id} style={[styles.requestLine, { color: c.textMuted }]}>
              {request.kind === 'access' ? 'Copy' : 'Erasure'} asked{' '}
              {formatRelativeDay(request.created_at)} · {request.status.replace('_', ' ')} · due{' '}
              {formatDateLong(request.due_at)}
            </Text>
          ))}
        </Card>
      </ScrollView>

      <Sheet
        visible={openTicket !== null}
        onClose={() => setOpenTicket(null)}
        title={openTicket?.subject ?? 'Your message'}
      >
        <View style={styles.sheet}>
          <Text style={[styles.body, { color: c.textSecondary }]}>{openTicket?.body}</Text>
          {notes.map((note) => (
            <View key={note.id} style={[styles.note, { backgroundColor: c.bgSurface }]}>
              <Text style={[styles.noteMeta, { color: c.textMuted }]}>
                {formatDateLong(note.created_at)}
              </Text>
              <Text style={[styles.body, { color: c.textPrimary }]}>{note.body}</Text>
            </View>
          ))}
          <TextField
            label="Add something"
            placeholder="It is still happening this morning"
            value={reply}
            onChangeText={setReply}
            multiline
          />
          <Button label="Send" onPress={sendReply} disabled={!reply.trim()} fullWidth />
        </View>
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },
  contentWide: {
    padding: Spacing.lg,
    maxWidth: DesktopContentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  cardTitle: { ...Typography.heading, fontFamily: FontFamily.semiBold },
  cardHint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 19,
    marginTop: 2,
  },
  form: { gap: Spacing.sm, marginTop: Spacing.md },
  sectionTitle: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
    marginTop: Spacing.sm,
  },
  rows: { gap: Spacing.sm },
  dataActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap' },
  requestLine: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.xs,
    lineHeight: 16,
  },
  sheet: { gap: Spacing.sm, paddingBottom: Spacing.md },
  body: { ...Typography.body, fontFamily: FontFamily.regular, lineHeight: 22 },
  note: { borderRadius: Radius.md, padding: Spacing.md, gap: 2 },
  noteMeta: { ...Typography.label, fontFamily: FontFamily.regular },
})
