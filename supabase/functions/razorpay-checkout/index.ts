// Deno edge function. Deploy with: supabase functions deploy razorpay-checkout
// Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as function secrets.
//
// Starts a subscription (PRODUCT.md §3). Returns a hosted Razorpay URL the app
// opens in a browser — the same shape as the Instagram flow in 033, and for the
// same reason: no native SDK, one code path on web and native, and no card
// details ever touching our app.
//
// ── The price is computed here, never received ──────────────────────────────
//
// The request says which TERM. It does not say what that costs. term_price_paise()
// in 035 decides, and whether the launch discount applies is intro_is_live()'s
// call, not the client's. A client that could name its own amount would be a
// client that could buy a year for ₹1.
//
// ── Why Subscriptions rather than a one-off order ───────────────────────────
//
// §3 sells 1/3/6/9/12-month terms and a creator should not have to remember to
// pay again. Razorpay Subscriptions carry the recurring mandate — UPI Autopay,
// card e-mandate, netbanking — which is why §3 chose Razorpay over Stripe.
//
// A consequence worth stating: when the launch offer closes, an existing
// monthly subscriber cannot simply be charged more. RBI requires re-authorisation
// for a changed debit amount, so she gets a NEW subscription to approve. That is
// handled by this endpoint being what she comes back to, not by silently editing
// a mandate.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY = 'https://api.razorpay.com/v1'

/** Razorpay's period vocabulary, and how many of them a term is. */
const TERM_TO_RAZORPAY: Record<string, { period: string; interval: number }> = {
  monthly: { period: 'monthly', interval: 1 },
  quarterly: { period: 'monthly', interval: 3 },
  half_yearly: { period: 'monthly', interval: 6 },
  nine_month: { period: 'monthly', interval: 9 },
  yearly: { period: 'yearly', interval: 1 },
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  })

function auth(): string {
  const id = Deno.env.get('RAZORPAY_KEY_ID')
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET')
  if (!id || !secret) throw new Error('not_configured')
  return `Basic ${btoa(`${id}:${secret}`)}`
}

async function razorpay(path: string, body?: unknown) {
  const res = await fetch(`${RAZORPAY}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await res.json()
  if (!res.ok) {
    console.error('razorpay', path, res.status, payload?.error?.description)
    throw new Error(payload?.error?.description ?? 'Razorpay rejected the request')
  }
  return payload
}

/**
 * The Razorpay Plan for this term at this price, created once and cached.
 *
 * Keyed on the amount as well as the term: a Razorpay plan is immutable, so
 * when the launch offer closes ₹999/monthly and ₹1,999/monthly are two separate
 * plans — and both have to keep existing, because subscribers on the old one
 * keep renewing against it.
 */
async function planIdFor(termKey: string, amountPaise: number): Promise<string> {
  const { data: cached } = await admin
    .from('razorpay_plans')
    .select('razorpay_plan_id')
    .eq('term_key', termKey)
    .eq('amount_paise', amountPaise)
    .maybeSingle()

  if (cached?.razorpay_plan_id) return cached.razorpay_plan_id as string

  const shape = TERM_TO_RAZORPAY[termKey]
  if (!shape) throw new Error(`Unknown term ${termKey}`)

  const plan = await razorpay('/plans', {
    period: shape.period,
    interval: shape.interval,
    item: {
      name: `Blubanana ${termKey}`,
      amount: amountPaise,
      currency: 'INR',
      description: 'Blubanana subscription',
    },
  })

  await admin.from('razorpay_plans').insert({
    term_key: termKey,
    amount_paise: amountPaise,
    razorpay_plan_id: plan.id,
  })

  return plan.id as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Not authenticated' }, 401)

    const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    const user = userData?.user
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { term } = (await req.json()) as { term?: string }
    if (!term) return json({ error: 'Which term?' }, 400)

    // Only an owner may put the workspace on a paid plan. A manager with money
    // access can read what was charged; committing the business to a recurring
    // mandate is not theirs to do.
    const { data: membership } = await admin
      .from('memberships')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!membership) return json({ error: 'Only the workspace owner can subscribe' }, 403)
    const workspaceId = membership.workspace_id as string

    // ── Price, decided here ──────────────────────────────────────────────────
    const { data: introLive } = await admin.rpc('intro_is_live')
    const applyIntro = introLive === true

    const { data: amount, error: priceError } = await admin.rpc('term_price_paise', {
      term_key: term,
      apply_intro: applyIntro,
    })
    if (priceError || typeof amount !== 'number' || amount <= 0) {
      return json({ error: 'Could not price that term' }, 400)
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('name, phone')
      .eq('id', user.id)
      .maybeSingle()

    // ── Customer, reused across renewals ─────────────────────────────────────
    const { data: existing } = await admin
      .from('subscriptions')
      .select('razorpay_customer_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    let customerId = existing?.razorpay_customer_id as string | null
    if (!customerId) {
      const customer = await razorpay('/customers', {
        name: profile?.name || user.email,
        email: user.email,
        contact: profile?.phone ?? undefined,
        fail_existing: 0,
      })
      customerId = customer.id as string
    }

    const planId = await planIdFor(term, amount)

    // total_count is how many cycles the mandate is authorised for. Ten years
    // of cycles: long enough that nobody is asked to re-authorise for a reason
    // they would not understand, and finite because Razorpay requires a number.
    const cycles = term === 'yearly' ? 10 : Math.ceil(120 / (TERM_TO_RAZORPAY[term].interval || 1))

    const subscription = await razorpay('/subscriptions', {
      plan_id: planId,
      customer_id: customerId,
      total_count: cycles,
      customer_notify: 1,
      notes: {
        workspace_id: workspaceId,
        term,
        // Read back by the webhook so the record says what was actually agreed,
        // rather than being recomputed later against a price that has changed.
        intro_applied: String(applyIntro),
        amount_paise: String(amount),
      },
    })

    // Recorded before she pays, so a webhook that arrives first still finds a
    // row to update. Status is untouched: nothing is active until money moves.
    await admin
      .from('subscriptions')
      .update({
        razorpay_customer_id: customerId,
        razorpay_subscription_id: subscription.id,
        billing_term: term,
        intro_applied: applyIntro,
        agreed_term_paise: amount,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)

    return json({
      subscriptionId: subscription.id,
      // The hosted authorisation page. Opened in a browser, so card and UPI
      // details never pass through our app.
      url: subscription.short_url,
      amountPaise: amount,
      introApplied: applyIntro,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'not_configured') {
      return json({ error: 'Payments are not switched on yet', code: 'not_configured' }, 503)
    }
    console.error('razorpay-checkout failed', error)
    return json({ error: 'Could not start checkout' }, 500)
  }
})
