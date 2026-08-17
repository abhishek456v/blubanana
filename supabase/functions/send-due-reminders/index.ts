// Sends every reminder that has come due, as a real push notification.
//
// Invoked by pg_cron every few minutes (see migration 022's companion setup in
// the README). Not reachable from the app: it uses the service-role key to read
// across workspaces, so it authenticates on a shared secret rather than on a
// user's JWT.
//
// This replaces on-device scheduling. Local notifications only fire while the
// app has been opened on that device recently, which meant a creator who did
// not open the app for a week silently got nothing — on the one feature whose
// entire promise is that she never misses a deadline.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

/** Expo rejects a batch larger than this. */
const BATCH_SIZE = 100

interface DueReminder {
  id: string
  workspace_id: string
  deal_id: string | null
  title: string
  body: string | null
  type: string
}

interface PushToken {
  workspace_id: string
  token: string
}

Deno.serve(async (req) => {
  // Shared-secret auth. Anyone who can reach this URL could otherwise trigger
  // a send for every workspace on the platform.
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Due, not merely scheduled. Past-dated reminders are included on purpose:
  // an overdue nudge is the entire point, and skipping them would mean a
  // reminder whose moment passed while the cron was down is never sent.
  const { data: due, error: dueError } = await supabase
    .from('reminders')
    .select('id, workspace_id, deal_id, title, body, type')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .limit(500)

  if (dueError) {
    return Response.json({ error: dueError.message }, { status: 500 })
  }
  if (!due || due.length === 0) {
    return Response.json({ sent: 0, reminders: 0 })
  }

  const reminders = due as DueReminder[]
  const workspaceIds = [...new Set(reminders.map((r) => r.workspace_id))]

  const { data: tokenRows, error: tokenError } = await supabase
    .from('push_tokens')
    .select('workspace_id, token')
    .in('workspace_id', workspaceIds)

  if (tokenError) {
    return Response.json({ error: tokenError.message }, { status: 500 })
  }

  const tokensByWorkspace = new Map<string, string[]>()
  for (const row of (tokenRows ?? []) as PushToken[]) {
    const list = tokensByWorkspace.get(row.workspace_id) ?? []
    list.push(row.token)
    tokensByWorkspace.set(row.workspace_id, list)
  }

  const messages: Record<string, unknown>[] = []
  // A reminder with no device to send to is still marked sent. Leaving it
  // scheduled would make it fire the moment she next registers a device, which
  // could be weeks of stale deadlines arriving at once.
  const sentIds: string[] = []

  for (const reminder of reminders) {
    sentIds.push(reminder.id)
    for (const token of tokensByWorkspace.get(reminder.workspace_id) ?? []) {
      messages.push({
        to: token,
        title: reminder.title,
        // Amounts are deliberately absent from every notification body the app
        // creates (see PRODUCT.md 8.9). Lock-screen previews are visible to
        // anyone near the phone, and a creator's rates are the most sensitive
        // thing this product holds.
        body: reminder.body ?? '',
        sound: 'default',
        data: { reminderId: reminder.id, dealId: reminder.deal_id, type: reminder.type },
        // Collapses repeats on the device rather than stacking a week of them.
        channelId: 'reminders',
      })
    }
  }

  let delivered = 0
  let failed = 0
  // Tokens Expo reported as belonging to an uninstalled app. Collected by
  // zipping each ticket back to the message it answers: Expo returns tickets
  // in request order, and that pairing is the only way to know WHICH token
  // died rather than just how many did.
  const deadTokens: string[] = []

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(batch),
      })
      const payload = await res.json()
      // Expo answers 200 with per-message tickets, so a failed send is found
      // in the body rather than in the status code.
      const tickets: Record<string, never>[] = payload?.data ?? []
      tickets.forEach((ticket: any, index: number) => {
        if (ticket?.status === 'ok') {
          delivered++
          return
        }
        failed++
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          const token = batch[index]?.to
          if (typeof token === 'string') deadTokens.push(token)
        }
      })
    } catch (_error) {
      // Whole batch failed to reach Expo. Counted, but no token is blamed:
      // a network error says nothing about whether those devices still exist.
      failed += batch.length
    }
  }

  // Marked sent regardless of ticket outcome. A delivery failure is Expo's to
  // retry; re-sending from here on the next tick would spam a working device
  // for every reminder whose ticket happened to error once.
  const { error: updateError } = await supabase
    .from('reminders')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .in('id', sentIds)

  if (updateError) {
    return Response.json({ error: updateError.message, delivered }, { status: 500 })
  }

  // DeviceNotRegistered means the app was uninstalled. Retiring those keeps the
  // table from growing into a list of dead phones that every future send pays
  // to address.
  if (deadTokens.length > 0) {
    await supabase.from('push_tokens').delete().in('token', deadTokens)
  }

  return Response.json({
    reminders: reminders.length,
    messages: messages.length,
    delivered,
    failed,
    retiredTokens: deadTokens.length,
  })
})
