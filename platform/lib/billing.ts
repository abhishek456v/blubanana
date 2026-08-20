import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'

// Starting a subscription (PRODUCT.md §3, migration 036).
//
// The app never sees a card, a UPI ID or a price it can influence. It asks for
// a term; the edge function decides what that costs and returns a hosted
// Razorpay page to open. Everything after that happens between the creator,
// Razorpay and the webhook.

export class PaymentsNotConfigured extends Error {
  constructor() {
    super('Payments are not switched on yet')
    this.name = 'PaymentsNotConfigured'
  }
}

export interface CheckoutStarted {
  subscriptionId: string
  amountPaise: number
  introApplied: boolean
}

/**
 * Opens Razorpay's hosted authorisation page for a term.
 *
 * Returns after the browser closes, which says nothing about whether she paid:
 * she may have approved, abandoned, or closed the tab, and only the webhook
 * knows which. The caller re-reads the subscription rather than assuming — the
 * same shape as the Instagram flow, and for the same reason.
 */
export async function startCheckout(term: string): Promise<CheckoutStarted> {
  const { data, error } = await supabase.functions.invoke('razorpay-checkout', {
    body: { term },
  })

  // A 503 with this code means the keys are not set on the server yet, which is
  // a different thing from a failure and deserves a different sentence.
  //
  // 404 counts too, and did not used to. Razorpay is deliberately switched off,
  // so the function is not deployed at all, and an undeployed function answers
  // 404 rather than 503. That fell through to "Could not open the payment
  // page", which reads as a fault on a working system rather than as a feature
  // that is honestly not on yet. Nobody is charged either way; only the
  // sentence differs, and the accurate one is worth having.
  if (data?.code === 'not_configured') throw new PaymentsNotConfigured()
  if (error) {
    const message = (error as { message?: string }).message ?? ''
    if (/\b(404|503)\b|not found/i.test(message)) throw new PaymentsNotConfigured()
    throw error
  }
  if (!data?.url) throw new Error('Razorpay did not return a payment page')

  await WebBrowser.openBrowserAsync(data.url as string)

  return {
    subscriptionId: data.subscriptionId as string,
    amountPaise: data.amountPaise as number,
    introApplied: data.introApplied as boolean,
  }
}

export interface SubscriptionInvoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  totalPaise: number
}

/** Our GST invoices to this workspace. §3 requires one per payment. */
export async function getSubscriptionInvoices(): Promise<SubscriptionInvoice[]> {
  const { data, error } = await supabase
    .from('subscription_invoices')
    .select('id, invoice_number, invoice_date, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise')
    .order('invoice_date', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string,
    invoiceNumber: row.invoice_number as string,
    invoiceDate: row.invoice_date as string,
    taxablePaise: row.taxable_paise as number,
    cgstPaise: row.cgst_paise as number,
    sgstPaise: row.sgst_paise as number,
    igstPaise: row.igst_paise as number,
    totalPaise: row.total_paise as number,
  }))
}
