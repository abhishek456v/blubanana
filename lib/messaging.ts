import { Linking } from 'react-native'
import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'
import { buildWhatsAppLink } from './whatsapp'

// The outbox: every message drafted for a brand is a row before it goes
// anywhere (migration 014).
//
// The product rule this implements is the spec's strictest: nothing reaches a
// brand without explicit approval. That is enforced by a check constraint on
// the table, not by this file: these functions are the convenient path, and
// the database is the guarantee.

export type MessageChannel = 'whatsapp' | 'email' | 'sms'

export type MessagePurpose =
  | 'delivery_notification'
  | 'payment_reminder_pre'
  | 'payment_reminder_due'
  | 'payment_reminder_overdue'
  | 'ad_rights_followup'
  | 'custom'

export type MessageStatus = 'draft' | 'approved' | 'sent' | 'cancelled'

export interface OutboundMessage {
  id: string
  workspace_id: string
  deal_id: string | null
  payment_id: string | null
  channel: MessageChannel
  purpose: MessagePurpose
  escalation_level: number
  recipient: string | null
  body: string
  status: MessageStatus
  approved_by: string | null
  approved_at: string | null
  /** When the message was handed to WhatsApp. NOT proof of delivery. */
  handed_off_at: string | null
  created_at: string
  updated_at: string
}

export interface DraftMessageInput {
  dealId: string | null
  paymentId?: string | null
  purpose: MessagePurpose
  body: string
  recipient?: string | null
  channel?: MessageChannel
  escalationLevel?: number
}

/** Creates a draft. Drafts are inert: nothing can send from this state. */
export async function draftMessage(input: DraftMessageInput): Promise<OutboundMessage> {
  const { data, error } = await supabase
    .from('outbound_messages')
    .insert({
      workspace_id: await getWorkspaceId(),
      deal_id: input.dealId,
      payment_id: input.paymentId ?? null,
      channel: input.channel ?? 'whatsapp',
      purpose: input.purpose,
      escalation_level: input.escalationLevel ?? 0,
      recipient: input.recipient ?? null,
      body: input.body,
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw error
  return data as OutboundMessage
}

/**
 * Records the creator's approval and opens WhatsApp with the message
 * pre-filled, addressed to the brand.
 *
 * Approval is written *before* the handoff, deliberately. If it were written
 * after, a creator who approves and then has the WhatsApp launch fail would
 * end up with a message the app believes was never approved, and the reminder
 * engine would draft another one tomorrow.
 *
 * Returns false when there is no usable phone number, so the caller can prompt
 * for one rather than failing silently.
 */
export async function approveAndHandOff(
  message: OutboundMessage,
  phone: string | null
): Promise<boolean> {
  const link = phone ? buildWhatsAppLink(phone, message.body) : null
  if (!link) return false

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('outbound_messages')
    .update({
      status: 'sent',
      approved_by: user.id,
      approved_at: now,
      handed_off_at: now,
      // Snapshotted so the log still says who it went to after the brand's
      // contact details are later edited.
      recipient: phone,
    })
    .eq('id', message.id)

  if (error) throw error

  await Linking.openURL(link)
  return true
}

/** Drafts and hands off in one step: the common case from a deal screen. */
export async function sendNow(
  input: DraftMessageInput,
  phone: string | null
): Promise<boolean> {
  const draft = await draftMessage(input)
  try {
    return await approveAndHandOff(draft, phone)
  } catch (err) {
    // A draft left stranded would sit in the history looking like an unsent
    // message the creator forgot about, so it is cancelled rather than left.
    await supabase
      .from('outbound_messages')
      .update({ status: 'cancelled' })
      .eq('id', draft.id)
    throw err
  }
}

export async function getMessagesForDeal(dealId: string): Promise<OutboundMessage[]> {
  const { data, error } = await supabase
    .from('outbound_messages')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as OutboundMessage[]
}

/**
 * The most recent chaser sent for a payment, if any.
 *
 * The reminder engine checks this before drafting another. Without it, opening
 * the deal screen twice in a day would offer two identical nudges, and an app
 * that nags is one the creator stops reading.
 */
export async function getLastChaser(paymentId: string): Promise<OutboundMessage | null> {
  const { data, error } = await supabase
    .from('outbound_messages')
    .select('*')
    .eq('payment_id', paymentId)
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as OutboundMessage) ?? null
}

/** Whether a chaser already went out today for this payment. */
export async function chasedToday(paymentId: string): Promise<boolean> {
  const last = await getLastChaser(paymentId)
  if (!last?.handed_off_at) return false
  return last.handed_off_at.slice(0, 10) === new Date().toISOString().slice(0, 10)
}

/**
 * How firm the next chaser should be, from how many have already gone out.
 *
 * Escalation is driven by what was actually sent rather than by how overdue the
 * payment is: a creator who only started chasing today should not open with the
 * tone of a fourth follow-up.
 */
export async function nextEscalationLevel(paymentId: string): Promise<number> {
  const { count, error } = await supabase
    .from('outbound_messages')
    .select('id', { count: 'exact', head: true })
    .eq('payment_id', paymentId)
    .eq('status', 'sent')
    .like('purpose', 'payment_reminder%')

  if (error) throw error
  return Math.min(count ?? 0, 3)
}
