// Deno edge function. Deploy with: supabase functions deploy extract-deal
// Requires OPENAI_API_KEY set as a function secret (see README.md).
//
// Accepts either a screenshot (base64 image) or a voice-note transcript and
// returns structured deal fields via GPT-4o, using one shared extraction
// prompt so both intake methods behave consistently (PRODUCT.md 2.1).

import { corsHeaders } from '../_shared/cors.ts'
import {
  buildSystemPrompt,
  VALID_DELIVERABLE_KINDS,
  VALID_PLATFORMS,
  type ExtractedDealFields,
  type ExtractedDeliverable,
} from '../_shared/extraction-schema.ts'

interface RequestBody {
  imageBase64?: string
  mimeType?: string
  transcript?: string
}

const EMPTY_FIELDS: ExtractedDealFields = {
  brand_name: null,
  platform: null,
  deliverable_description: null,
  deliverables: [],
  rate: null,
  payment_terms: null,
  script_due_date: null,
  shoot_date: null,
  edit_done_date: null,
  publish_date: null,
  notes: null,
}

/** Guards against a runaway model response turning into 400 form rows. */
const MAX_DELIVERABLES = 12

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Coerces whatever the model returned into a well-typed ExtractedDealFields,
// dropping any value that doesn't match the expected shape rather than
// trusting the model's JSON verbatim.
function sanitize(raw: unknown): ExtractedDealFields {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_FIELDS }
  const r = raw as Record<string, unknown>

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const date = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) ? v : null)
  const platform = (v: unknown) =>
    typeof v === 'string' && (VALID_PLATFORMS as readonly string[]).includes(v)
      ? (v as ExtractedDealFields['platform'])
      : null
  const rate = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    // Zero is meaningful (a barter deal really is worth 0), so only reject
    // values that aren't numbers at all, or are negative.
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }

  // Each row is validated independently and dropped if its `kind` isn't one we
  // recognise, so one bad item can't discard the whole itemisation.
  const deliverables = (v: unknown): ExtractedDeliverable[] => {
    if (!Array.isArray(v)) return []
    const out: ExtractedDeliverable[] = []

    for (const entry of v.slice(0, MAX_DELIVERABLES)) {
      if (typeof entry !== 'object' || entry === null) continue
      const e = entry as Record<string, unknown>

      if (
        typeof e.kind !== 'string' ||
        !(VALID_DELIVERABLE_KINDS as readonly string[]).includes(e.kind)
      ) {
        continue
      }

      const quantityRaw =
        typeof e.quantity === 'number'
          ? e.quantity
          : typeof e.quantity === 'string'
            ? Number(e.quantity)
            : 1

      out.push({
        kind: e.kind as ExtractedDeliverable['kind'],
        quantity:
          Number.isFinite(quantityRaw) && quantityRaw >= 1 ? Math.round(quantityRaw) : 1,
        description: str(e.description),
        rate: rate(e.rate),
      })
    }

    return out
  }

  return {
    brand_name: str(r.brand_name),
    platform: platform(r.platform),
    deliverable_description: str(r.deliverable_description),
    deliverables: deliverables(r.deliverables),
    rate: rate(r.rate),
    payment_terms: str(r.payment_terms),
    script_due_date: date(r.script_due_date),
    shoot_date: date(r.shoot_date),
    edit_done_date: date(r.edit_done_date),
    publish_date: date(r.publish_date),
    notes: str(r.notes),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server is missing OPENAI_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body: RequestBody = await req.json()
    const { imageBase64, mimeType, transcript } = body

    if (!imageBase64 && !transcript) {
      return new Response(
        JSON.stringify({ error: 'Provide either imageBase64 or transcript' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userContent: unknown[] = []
    if (imageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` },
      })
      userContent.push({ type: 'text', text: 'Extract the deal fields from this screenshot.' })
    } else {
      userContent.push({
        type: 'text',
        text: `Extract the deal fields from this voice note transcript:\n\n${transcript}`,
      })
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('OpenAI extraction error:', errText)
      return new Response(JSON.stringify({ error: 'Extraction failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const completion = await openaiRes.json()
    const raw = completion.choices?.[0]?.message?.content
    let parsed: unknown
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch {
      parsed = {}
    }

    const fields = sanitize(parsed)

    return new Response(JSON.stringify({ fields }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('extract-deal error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
