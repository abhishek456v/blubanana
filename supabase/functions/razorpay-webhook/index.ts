// Deno edge function. Deploy with: supabase functions deploy razorpay-webhook
// Requires RAZORPAY_WEBHOOK_SECRET as a function secret.
//
// The only thing that may mark a subscription paid. 035 revokes writes on
// `subscriptions` from `authenticated`, so this — running with the service
// role — is the sole path from "she pressed pay" to "she can write again".
//
// ── Authentication is the signature, and nothing else ───────────────────────
//
// Razorpay POSTs here from their servers with no session, so verify_jwt is off
// (config.toml). The guard is an HMAC-SHA256 of the RAW body against the
// webhook secret. Two things follow from that:
//
//   * The body must be read as text and verified BEFORE it is parsed. Parsing
//     and re-serialising changes the bytes and the signature will not match.
//   * The comparison is constant-time. A byte-by-byte early return leaks how
//     much of a forged signature was correct, which is enough to reconstruct
//     one given patience.
//
// ── Idempotency ─────────────────────────────────────────────────────────────
//
// Razorpay retries. `razorpay_payment_id` is unique, so a replayed event
// inserts nothing the second time and the invoice is not issued twice — which
// matters more than usual here, because a duplicate would put a hole in a GST
// series that has to be gapless.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

/** Indian financial year label for a date: April → March. */
function financialYear(date: Date): string {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
  return `${year}-${String(year + 1).slice(2)}`
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time compare. Length is not secret; content is. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
  if (!secret) {
    console.error('razorpay-webhook: RAZORPAY_WEBHOOK_SECRET not set')
    return new Response('Not configured', { status: 503 })
  }

  // Raw text, before any parsing. See the header.
  const raw = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  if (!safeEqual(await hmacHex(secret, raw), signature)) {
    // Deliberately terse. An attacker probing this endpoint learns nothing
    // about why their signature was wrong.
    return new Response('Invalid signature', { status: 401 })
  }

  try {
    const event = JSON.parse(raw)
    const kind: string = event.event ?? ''
    const sub = event.payload?.subscription?.entity
    const payment = event.payload?.payment?.entity
    const razorpaySubscriptionId: string | undefined = sub?.id ?? payment?.subscription_id

    if (!razorpaySubscriptionId) return new Response('ok', { status: 200 })

    const { data: row } = await admin
      .from('subscriptions')
      .select('workspace_id, billing_term, intro_applied, agreed_term_paise')
      .eq('razorpay_subscription_id', razorpaySubscriptionId)
      .maybeSingle()

    if (!row) {
      // Not ours, or arrived before checkout finished writing. 200 regardless:
      // a non-2xx makes Razorpay retry forever on an event we will never match.
      console.warn('razorpay-webhook: no subscription for', razorpaySubscriptionId)
      return new Response('ok', { status: 200 })
    }

    const workspaceId = row.workspace_id as string

    // ── Status ───────────────────────────────────────────────────────────────
    // `charged` is the one that matters: it is the event that means money
    // actually moved. `activated` only means the mandate was approved.
    const statusFor: Record<string, string> = {
      'subscription.activated': 'active',
      'subscription.charged': 'active',
      'subscription.pending': 'past_due',
      'subscription.halted': 'past_due',
      'subscription.cancelled': 'cancelled',
      'subscription.completed': 'expired',
    }

    const nextStatus = statusFor[kind]
    if (nextStatus) {
      await admin
        .from('subscriptions')
        .update({
          status: nextStatus,
          // Razorpay's own end-of-cycle, so the read-only gate and their
          // billing agree on the day cover lapses.
          current_period_end: sub?.current_end
            ? new Date(sub.current_end * 1000).toISOString()
            : undefined,
          cancelled_at: kind === 'subscription.cancelled' ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId)
    }

    // ── Money, and the invoice for it ────────────────────────────────────────
    if (kind === 'subscription.charged' && payment?.id) {
      const totalPaise: number = payment.amount ?? row.agreed_term_paise ?? 0
      // The charge includes GST; the taxable value is what it was added to.
      const taxablePaise = Math.round(totalPaise / 1.18)
      const gstPaise = totalPaise - taxablePaise

      const { data: inserted } = await admin
        .from('subscription_payments')
        .upsert(
          {
            workspace_id: workspaceId,
            razorpay_payment_id: payment.id,
            razorpay_subscription_id: razorpaySubscriptionId,
            amount_paise: taxablePaise,
            gst_paise: gstPaise,
            total_paise: totalPaise,
            term_key: row.billing_term,
            status: 'captured',
            period_start: sub?.current_start
              ? new Date(sub.current_start * 1000).toISOString()
              : null,
            period_end: sub?.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
          },
          { onConflict: 'razorpay_payment_id', ignoreDuplicates: true }
        )
        .select('id')
        .maybeSingle()

      // Null means the payment was already recorded — a retry. Issuing a second
      // invoice for it would put a duplicate in a GST series that must be
      // gapless and one-to-one with the money.
      if (inserted?.id) {
        const { data: profile } = await admin
          .from('profiles')
          .select('name, gstin, address')
          .eq('id', workspaceId)
          .maybeSingle()

        const fy = financialYear(new Date())
        const { data: number } = await admin.rpc('next_subscription_invoice_number', { fy })

        // Place of supply decides the split. Unknown state means we cannot
        // prove it is intra-State, and IGST is the safe side to be wrong on:
        // over-collecting CGST/SGST on an inter-State supply is the error that
        // cannot be fixed by the customer's input credit.
        const stateCode: string | null = null
        const interState = true

        await admin.from('subscription_invoices').insert({
          workspace_id: workspaceId,
          payment_id: inserted.id,
          invoice_number: number,
          financial_year: fy,
          customer_name: profile?.name || 'Subscriber',
          customer_gstin: profile?.gstin ?? null,
          customer_state_code: stateCode,
          taxable_paise: taxablePaise,
          cgst_paise: interState ? 0 : Math.floor(gstPaise / 2),
          sgst_paise: interState ? 0 : gstPaise - Math.floor(gstPaise / 2),
          igst_paise: interState ? gstPaise : 0,
          total_paise: totalPaise,
        })
      }
    }

    return new Response('ok', { status: 200 })
  } catch (error) {
    console.error('razorpay-webhook failed', error)
    // 500 so Razorpay retries: losing a `charged` event means a creator who
    // paid stays locked out.
    return new Response('error', { status: 500 })
  }
})
