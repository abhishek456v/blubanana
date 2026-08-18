// Deno edge function. Deploy with: supabase functions deploy extract-deals
// Requires OPENAI_API_KEY as a function secret.
//
// The bulk sibling of `extract-deal` (PRODUCT.md §8.2). Same extraction, many
// deals at once, from whatever a creator already keeps her work in: a
// spreadsheet export, a screenshot of her notes app, a page of a diary.
//
// §8.2 is blunt about why this exists — "a creator arriving has live deals
// already. If day one is 'type in all eight', she leaves."
//
// Nothing here saves anything. It returns candidates for review, exactly as
// the single-deal path does: the model gets things wrong, and a CRM that
// silently invented eight deals would be worse than one that imported none.

import { corsHeaders } from '../_shared/cors.ts'
import {
  VALID_DELIVERABLE_KINDS,
  VALID_PLATFORMS,
  type ExtractedDealFields,
} from '../_shared/extraction-schema.ts'

interface RequestBody {
  /** A spreadsheet export, pasted notes, or any other text list. */
  text?: string
  /** A photographed or exported image of the same. */
  imageBase64?: string
  mimeType?: string
}

/**
 * Caps. A spreadsheet with 800 rows would blow the context window, cost real
 * money, and hand back a review list nobody will read. Importing the most
 * recent 40 and letting her repeat the process is the honest limit.
 */
const MAX_DEALS = 40
const MAX_TEXT_CHARS = 24_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function int(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : null
}

function date(value: unknown): string | null {
  const s = str(value)
  return s && DATE_RE.test(s) ? s : null
}

/** Coerces one model row into the same shape the single-deal path produces. */
function sanitizeDeal(raw: unknown): ExtractedDealFields | null {
  const item = raw as Record<string, unknown>
  const brand = str(item.brand_name)
  const description = str(item.deliverable_description)

  // A row with neither a brand nor a description is not a deal, it is a blank
  // spreadsheet line or a header the model mistook for data.
  if (!brand && !description) return null

  const platform = str(item.platform)
  const deliverables = Array.isArray(item.deliverables)
    ? item.deliverables
        .map((d) => {
          const row = d as Record<string, unknown>
          const kind = str(row.kind)
          if (!kind || !VALID_DELIVERABLE_KINDS.includes(kind as never)) return null
          return {
            kind: kind as ExtractedDealFields['deliverables'][number]['kind'],
            quantity: int(row.quantity) ?? 1,
            description: str(row.description),
            rate: int(row.rate),
          }
        })
        .filter((d): d is ExtractedDealFields['deliverables'][number] => d !== null)
        .slice(0, 12)
    : []

  return {
    brand_name: brand,
    platform:
      platform && VALID_PLATFORMS.includes(platform as never)
        ? (platform as ExtractedDealFields['platform'])
        : null,
    deliverable_description: description,
    deliverables,
    rate: int(item.rate),
    payment_terms: str(item.payment_terms),
    script_due_date: date(item.script_due_date),
    shoot_date: date(item.shoot_date),
    edit_done_date: date(item.edit_done_date),
    publish_date: date(item.publish_date),
    notes: str(item.notes),
  }
}

function buildPrompt(): string {
  const today = new Date().toISOString().split('T')[0]
  return `You extract brand deals for an Indian content creator's CRM from a list she already keeps.

The input is a spreadsheet export, pasted notes, or an image of either. It
contains SEVERAL deals — usually one per row or per line.

Return ONLY JSON: {"deals":[ ... ]}, where each entry is:

{
  "brand_name": string | null,
  "platform": string | null,               // one of: ${VALID_PLATFORMS.join(', ')}
  "deliverable_description": string | null,
  "deliverables": [{ "kind": string, "quantity": number, "description": string | null, "rate": number | null }],
  "rate": number | null,                   // TOTAL INR, plain integer, no symbols or commas
  "payment_terms": string | null,
  "script_due_date": string | null,        // YYYY-MM-DD
  "shoot_date": string | null,
  "edit_done_date": string | null,
  "publish_date": string | null,
  "notes": string | null
}

Rules:
- One entry per deal. Do not merge two brands into one entry, and do not split
  one deal across two.
- Skip header rows, totals, blank lines and anything that is not a deal.
- Today is ${today}. Resolve relative dates ("next Friday") against it.
- "1.5L" is 150000. "45k" is 45000. Never return a string in a number field.
- A field you cannot find is null. Do not guess a rate, and do not invent a
  date that is not there — a wrong deadline is worse than a missing one,
  because she will plan around it.
- At most ${MAX_DEALS} deals. If there are more, return the most recent.`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'Server is missing OPENAI_API_KEY' }, 500)

    const body = (await req.json()) as RequestBody
    const text = body.text?.slice(0, MAX_TEXT_CHARS)

    if (!text && !body.imageBase64) {
      return json({ error: 'Send either text or an image' }, 400)
    }

    const content = body.imageBase64
      ? [
          { type: 'text', text: 'Extract every deal in this image.' },
          {
            type: 'image_url',
            image_url: { url: `data:${body.mimeType ?? 'image/jpeg'};base64,${body.imageBase64}` },
          },
        ]
      : `Extract every deal in this list.\n\n${text}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0,
        messages: [
          { role: 'system', content: buildPrompt() },
          { role: 'user', content },
        ],
      }),
    })

    if (!openaiRes.ok) {
      console.error('extract-deals: OpenAI returned', openaiRes.status)
      return json({ error: 'Could not read that file' }, 502)
    }

    const completion = await openaiRes.json()
    const raw = completion?.choices?.[0]?.message?.content
    if (typeof raw !== 'string') return json({ deals: [] }, 200)

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ deals: [] }, 200)
    }

    const rows = (parsed as { deals?: unknown }).deals
    const deals = Array.isArray(rows)
      ? rows
          .map(sanitizeDeal)
          .filter((d): d is ExtractedDealFields => d !== null)
          .slice(0, MAX_DEALS)
      : []

    return json({ deals }, 200)
  } catch (error) {
    console.error('extract-deals failed', error)
    return json({ error: 'Could not read that file' }, 500)
  }
})
