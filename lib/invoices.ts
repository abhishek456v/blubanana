import { supabase } from './supabase'
import type { Invoice } from '@/types'

// Tax & invoicing (Phase 3). RLS on invoices restricts reads/writes to the
// authenticated user's own rows. No payment gateway integration here —
// PRODUCT.md section 0 explicitly deferred Razorpay/Stripe to after Phase 1,
// and invoicing doesn't need one (it's a document, not a checkout).

export interface CreateInvoiceInput {
  deal_id: string
  brand_name: string
  brand_contact_person: string | null
  brand_contact_email: string | null
  description: string
  amount: number
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
    .eq('creator_id', user.id)
  if (countError) throw countError

  const gstAmount = input.gst_applicable ? Math.round((input.amount * GST_RATE) / 100) : 0
  const totalAmount = input.amount + gstAmount

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      creator_id: user.id,
      deal_id: input.deal_id,
      invoice_number: nextInvoiceNumber(count ?? 0),
      brand_name: input.brand_name,
      brand_contact_person: input.brand_contact_person,
      brand_contact_email: input.brand_contact_email,
      description: input.description,
      amount: input.amount,
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
  return data as Invoice
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
