// Deno edge function. Deploy with: supabase functions deploy suggest-rates
// Requires OPENAI_API_KEY as a function secret (see README.md).
//
// Suggests a starting price for deliverables a creator has never charged for
// (PRODUCT.md §8.11). Gap-fill only: her own history always wins where it
// exists, and the app decides which kinds are missing before calling here.
//
// The suggestions are proposals. They land in the card editor for her to
// review, adjust and apply — nothing reaches the card unconfirmed. A card that
// quoted an invented price as if it had been earned would be the single worst
// thing this product could do to a negotiation.

import { corsHeaders } from '../_shared/cors.ts'

interface RequestBody {
  niche?: string | null
  followers?: number | null
  engagementRate?: number | null
  /** Deliverable kinds she has no history for. */
  missing?: string[]
  /** What she already charges, so suggestions sit sensibly against them. */
  known?: { kind: string; rate: number }[]
}

interface Suggestion {
  kind: string
  /** Whole rupees. */
  rate: number
  /** One short line she can read before accepting it. */
  basis: string
}

/** A runaway response must not turn into forty rows in the editor. */
const MAX_SUGGESTIONS = 12

const VALID_KINDS = [
  'reel',
  'story',
  'carousel',
  'static_post',
  'yt_short',
  'yt_long',
  'yt_integration',
  'live',
  'auto_dm',
]

/**
 * Coerces the model's JSON into well-typed suggestions, dropping anything that
 * does not match rather than trusting it verbatim. A hallucinated kind or a
 * rate of "around 30k" must not reach the client.
 */
function sanitize(raw: unknown, missing: string[]): Suggestion[] {
  const rows = (raw as { suggestions?: unknown })?.suggestions
  if (!Array.isArray(rows)) return []

  const seen = new Set<string>()
  const out: Suggestion[] = []

  for (const row of rows) {
    if (out.length >= MAX_SUGGESTIONS) break
    const item = row as Record<string, unknown>
    const kind = typeof item.kind === 'string' ? item.kind : null
    const rate = typeof item.rate === 'number' ? Math.round(item.rate) : null

    // Only kinds we asked about. The model does not get to decide that she
    // should also be selling podcasts.
    if (!kind || !VALID_KINDS.includes(kind) || !missing.includes(kind)) continue
    if (seen.has(kind)) continue
    if (rate === null || !Number.isFinite(rate) || rate <= 0 || rate > 100_000_000) continue

    seen.add(kind)
    out.push({
      kind,
      rate,
      basis: typeof item.basis === 'string' ? item.basis.slice(0, 140) : '',
    })
  }
  return out
}

function buildPrompt(body: RequestBody): string {
  const known = (body.known ?? [])
    .map((k) => `- ${k.kind}: ₹${k.rate}`)
    .join('\n')

  return `You price influencer marketing deliverables for the Indian creator market, in INR.

Creator:
- Niche: ${body.niche || 'unspecified'}
- Followers: ${body.followers ?? 'unknown'}
- Engagement rate: ${
    body.engagementRate != null ? `${(body.engagementRate * 100).toFixed(1)}%` : 'unknown'
  }

What this creator already charges${known ? ':\n' + known : ': nothing recorded yet.'}

Suggest a realistic 2026 market rate, in whole rupees, for ONLY these deliverable kinds: ${body.missing?.join(', ')}.

Rules:
- If the creator already charges for some formats, your suggestions must be
  consistent with them. A Story priced above their Reel is wrong.
- Price for this follower count and niche, not for a celebrity.
- Whole rupees, no ranges, no text in the rate field.
- "basis" is one short sentence explaining the figure, addressed to the creator.

Return JSON: {"suggestions":[{"kind":"reel","rate":25000,"basis":"..."}]}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'Server is missing OPENAI_API_KEY' }, 500)

    const body = (await req.json()) as RequestBody
    const missing = (body.missing ?? []).filter((k) => VALID_KINDS.includes(k))

    // Nothing to fill is a valid answer, and a cheaper one than asking.
    if (missing.length === 0) return json({ suggestions: [] }, 200)

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [{ role: 'user', content: buildPrompt({ ...body, missing }) }],
      }),
    })

    if (!openaiRes.ok) {
      console.error('suggest-rates: OpenAI returned', openaiRes.status)
      return json({ error: 'Could not reach the pricing model' }, 502)
    }

    const completion = await openaiRes.json()
    const content = completion?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return json({ suggestions: [] }, 200)

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      // A model that returned prose is a model that returned nothing usable.
      return json({ suggestions: [] }, 200)
    }

    return json({ suggestions: sanitize(parsed, missing) }, 200)
  } catch (error) {
    console.error('suggest-rates failed', error)
    return json({ error: 'Could not suggest rates' }, 500)
  }
})
