import { supabase } from './supabase'
import { getWorkspaceId } from './workspace'
import type { Invoice, InvoiceLineItem } from '@/types'

// Tax & invoicing (Phase 3). RLS on invoices restricts reads/writes to the
// authenticated user's own rows. No payment gateway integration here —
// PRODUCT.md section 0 explicitly deferred Razorpay/Stripe to after Phase 1,
// and invoicing doesn't need one (it's a document, not a checkout).

/** One billable line, before it is written. */
export interface LineItemInput {
  /** The deal it bills for, or null for an ad-hoc line. */
  deal_id: string | null
  description: string
  quantity?: number
  unit_amount: number
  hsn_sac?: string
}

export interface CreateInvoiceInput {
  /**
   * The originating deal for a single-deal invoice, or null when several deals
   * are consolidated onto one document — those carry their deals on the line
   * items instead.
   */
  deal_id: string | null
  brand_name: string
  brand_contact_person: string | null
  brand_contact_email: string | null
  /** Summary line, shown in lists. Derived from the items when not supplied. */
  description?: string
  /** The billed lines. The invoice subtotal is their sum. */
  items: LineItemInput[]
  gst_applicable: boolean
  payment_due_date: string | null
  tds_deducted: boolean
  tds_amount: number | null
  notes: string | null
}

const GST_RATE = 18

function nextInvoiceNumber(existingCount: number): string {
  return `INV-${String(existingCount + 1).padStart(3, '0')}`
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Best-effort sequential numbering — count-based, not a DB sequence, since
  // this app's usage volume (one creator, manually-triggered invoices) makes
  // a race condition here vanishingly unlikely, and it keeps the numbering
  // human-readable (INV-001, INV-002...) without a separate counter table.
  const { count, error: countError } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', await getWorkspaceId())
  if (countError) throw countError

  const workspaceId = await getWorkspaceId()

  const lines = input.items.map((item, index) => {
    const quantity = item.quantity ?? 1
    return {
      deal_id: item.deal_id,
      description: item.description,
      hsn_sac: item.hsn_sac ?? '998397',
      quantity,
      unit_amount: item.unit_amount,
      amount: quantity * item.unit_amount,
      sort_order: index,
    }
  })

  // The subtotal is always the sum of the lines. Deriving it here rather than
  // accepting it as a parameter means the printed total and the printed lines
  // cannot disagree — the one thing on an invoice that must never happen.
  const amount = lines.reduce((sum, line) => sum + line.amount, 0)
  const gstAmount = input.gst_applicable ? Math.round((amount * GST_RATE) / 100) : 0
  const totalAmount = amount + gstAmount

  const description =
    input.description ??
    (lines.length === 1
      ? lines[0].description
      : `${lines.length} items · ${lines[0]?.description ?? ''}`)

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      workspace_id: workspaceId,
      deal_id: input.deal_id,
      invoice_number: nextInvoiceNumber(count ?? 0),
      brand_name: input.brand_name,
      brand_contact_person: input.brand_contact_person,
      brand_contact_email: input.brand_contact_email,
      description,
      amount,
      gst_applicable: input.gst_applicable,
      gst_rate: GST_RATE,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      payment_due_date: input.payment_due_date,
      tds_deducted: input.tds_deducted,
      tds_amount: input.tds_deducted ? input.tds_amount : null,
      notes: input.notes,
    })
    .select()
    .single()
  if (error) throw error

  const invoice = data as Invoice

  const { error: lineError } = await supabase.from('invoice_line_items').insert(
    lines.map((line) => ({
      ...line,
      workspace_id: workspaceId,
      invoice_id: invoice.id,
    }))
  )
  // An invoice whose lines failed to write would print as a blank table, so
  // this rolls the header back rather than leaving a broken document behind.
  if (lineError) {
    await supabase.from('invoices').delete().eq('id', invoice.id)
    throw lineError
  }

  return invoice
}

export async function getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as InvoiceLineItem[]
}

export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Invoice[]
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
  if (error) throw error
  return data as Invoice
}

export async function getInvoiceForDeal(dealId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as Invoice | null
}
