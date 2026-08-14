import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn } from 'react-native-reanimated'
import { getMessagesForDeal, type MessagePurpose, type OutboundMessage } from '@/lib/messaging'
import { formatDateLong } from '@/lib/format'
import { FontFamily, Radius, Spacing, Typography } from '@/constants/design'
import { useTheme } from '@/hooks/useTheme'
import { Card, PressableScale } from '@/components/ui'

const PURPOSE_LABEL: Record<MessagePurpose, string> = {
  delivery_notification: 'Sent the live link',
  payment_reminder_pre: 'Payment due soon',
  payment_reminder_due: 'Payment due',
  payment_reminder_overdue: 'Chased payment',
  ad_rights_followup: 'Ad rights follow-up',
  custom: 'Message',
}

const PURPOSE_ICON: Record<MessagePurpose, keyof typeof Ionicons.glyphMap> = {
  delivery_notification: 'link',
  payment_reminder_pre: 'time-outline',
  payment_reminder_due: 'alert-circle-outline',
  payment_reminder_overdue: 'alert-circle',
  ad_rights_followup: 'megaphone-outline',
  custom: 'chatbubble-outline',
}

/**
 * Everything the creator has sent this brand about this deal.
 *
 * This is the card that turns the outbox from bookkeeping into something
 * useful: during a payment dispute, "I chased them on the 3rd, the 10th and
 * the 24th" is her evidence, and until now it lived only in her WhatsApp
 * scrollback where it could not be searched or cited.
 */
export function MessageHistoryCard({ dealId }: { dealId: string }) {
  const { c } = useTheme()
  const [messages, setMessages] = useState<OutboundMessage[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      setMessages(await getMessagesForDeal(dealId))
    } catch {
      // Non-fatal: the card simply doesn't render. Message history is a record,
      // not something the rest of the deal screen depends on.
    } finally {
      setLoaded(true)
    }
  }, [dealId])

  useEffect(() => {
    load()
  }, [load])

  const sent = messages.filter((m) => m.status === 'sent')

  // Nothing sent yet is the normal state for most of a deal's life, and an
  // empty card would just be noise on an already long screen.
  if (!loaded || sent.length === 0) return null

  return (
    <Card>
      <Text style={[styles.title, { color: c.textPrimary }]}>
        Sent to this brand
      </Text>
      <Text style={[styles.hint, { color: c.textSecondary }]}>
        {sent.length} {sent.length === 1 ? 'message' : 'messages'} · tap to read
      </Text>

      <View style={styles.list}>
        {sent.map((message) => {
          const isOpen = expanded === message.id
          const when = message.handed_off_at ?? message.created_at

          return (
            <PressableScale
              key={message.id}
              onPress={() => setExpanded(isOpen ? null : message.id)}
              scaleTo={0.995}
              style={[styles.row, { backgroundColor: c.bgPage }]}
            >
              <View style={styles.rowHead}>
                <Ionicons
                  name={PURPOSE_ICON[message.purpose]}
                  size={15}
                  color={
                    message.purpose === 'payment_reminder_overdue' ? c.warning : c.textSecondary
                  }
                />
                <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={1}>
                  {PURPOSE_LABEL[message.purpose]}
                </Text>
                <Text style={[styles.rowDate, { color: c.textMuted }]}>
                  {formatDateLong(when.slice(0, 10))}
                </Text>
              </View>

              {isOpen ? (
                <Animated.Text
                  entering={FadeIn.duration(140)}
                  style={[styles.body, { color: c.textSecondary }]}
                  selectable
                >
                  {message.body}
                </Animated.Text>
              ) : (
                <Text style={[styles.preview, { color: c.textMuted }]} numberOfLines={1}>
                  {message.body}
                </Text>
              )}
            </PressableScale>
          )
        })}
      </View>

      {/* Honest about what the app actually knows. It handed the message to
          WhatsApp; it never saw a delivery receipt. */}
      <Text style={[styles.footnote, { color: c.textMuted }]}>
        Opened in WhatsApp from your own number. Delivery isn't tracked.
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  title: {
    ...Typography.heading,
    fontFamily: FontFamily.semiBold,
  },
  hint: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.xxs,
  },
  list: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  row: {
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
    gap: 4,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowTitle: {
    flex: 1,
    ...Typography.body,
    fontFamily: FontFamily.medium,
  },
  rowDate: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
  },
  preview: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
  },
  body: {
    ...Typography.caption,
    fontFamily: FontFamily.regular,
    lineHeight: 19,
  },
  footnote: {
    ...Typography.label,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.md,
    lineHeight: 15,
  },
})
