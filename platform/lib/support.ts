import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'

/**
 * The creator's side of support and data requests.
 *
 * Straight to the tables under row-level security, not through an edge
 * function. There is nothing here that crosses a workspace boundary: a person
 * writes in, reads their own thread, and asks for their own data. The policies
 * in migration 043 say exactly that, and a function in the middle would only
 * be somewhere else for the same rule to be written down a second time.
 *
 * What a creator cannot do, whatever they send: choose a ticket's status or
 * priority, assign it, write an internal note, or file a request in somebody
 * else's name. Triggers overwrite all of those on the way in.
 */

export interface MyTicket {
  id: string
  subject: string
  body: string
  status: 'new' | 'open' | 'waiting' | 'closed'
  created_at: string
  updated_at: string
}

export interface MyTicketNote {
  id: string
  ticket_id: string
  author_id: string | null
  body: string
  created_at: string
}

export async function raiseTicket(input: { subject: string; body: string }): Promise<MyTicket> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  // Attached so the dashboard can open the right workspace beside the ticket.
  // Best effort: somebody writing in because they cannot get into their
  // workspace should still be able to write in.
  const workspaceId = await getWorkspaceId().catch(() => null)

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      // Sent because the insert policy checks it. Everything else about the
      // row is decided by the database, including this one being overwritten
      // with the same value.
      user_id: user.id,
      workspace_id: workspaceId,
      subject: input.subject.trim(),
      body: input.body.trim(),
    })
    .select()
    .single()

  if (error) throw error
  return data as MyTicket
}

export async function getMyTickets(): Promise<MyTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, subject, body, status, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as MyTicket[]
}

/**
 * The replies on one of my tickets.
 *
 * Internal notes are absent, and not because this asks for them to be: the
 * select policy hides them, so the same request made by hand against the API
 * returns the same rows.
 */
export async function getMyTicketNotes(ticketId: string): Promise<MyTicketNote[]> {
  const { data, error } = await supabase
    .from('support_ticket_notes')
    .select('id, ticket_id, author_id, body, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as MyTicketNote[]
}

export async function replyOnMyTicket(ticketId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('support_ticket_notes')
    .insert({ ticket_id: ticketId, body: body.trim() })
  if (error) throw error
}

/**
 * File a data request, under the DPDP Act.
 *
 * The product can already export everything and delete an account, so this is
 * not how either of those happens. It is the record that somebody asked, which
 * is the part that is actually required of a data fiduciary and the part that
 * did not exist.
 */
export async function fileDataRequest(kind: 'access' | 'erasure'): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const workspaceId = await getWorkspaceId().catch(() => null)

  const { error } = await supabase
    .from('data_requests')
    .insert({ user_id: user.id, workspace_id: workspaceId, kind })
  if (error) throw error
}

export async function getMyDataRequests(): Promise<
  { id: string; kind: string; status: string; created_at: string; due_at: string }[]
> {
  const { data, error } = await supabase
    .from('data_requests')
    .select('id, kind, status, created_at, due_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
