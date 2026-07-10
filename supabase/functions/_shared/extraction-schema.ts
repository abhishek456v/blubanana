// Shared between extract-deal's image and transcript paths — PRODUCT.md 2.1
// requires "same extraction prompt" for both intake methods so results are
// consistent regardless of entry point.

export const VALID_PLATFORMS = [
  'instagram_reel',
  'instagram_feed',
  'youtube_short',
  'youtube_long',
  'podcast',
  'twitter',
  'linkedin',
  'other',
] as const

// Kept in sync with ExtractedDealFields in types/index.ts. Duplicated here
// (rather than shared across the Deno/Node boundary) because edge functions
// bundle independently of the app's TypeScript project.
export interface ExtractedDealFields {
  brand_name: string | null
  platform: (typeof VALID_PLATFORMS)[number] | null
  deliverable_description: string | null
  rate: number | null
  payment_terms: string | null
  script_due_date: string | null
  shoot_date: string | null
  edit_done_date: string | null
  publish_date: string | null
  notes: string | null
}

export function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0]
  return `You extract structured brand-deal information for a content creator's CRM.
The input is either a screenshot of a brand's message/brief, or a transcript of
a voice note the creator recorded describing a new deal.

Return ONLY a JSON object with exactly these fields — no prose, no markdown:

{
  "brand_name": string | null,        // the brand/company name, e.g. "Nike"
  "platform": string | null,          // one of: ${VALID_PLATFORMS.join(', ')} — null if unclear
  "deliverable_description": string | null,  // what content is being made, e.g. "1 Instagram Reel + 3 Stories"
  "rate": number | null,              // plain integer INR rupees, no symbols/commas/decimals
  "payment_terms": string | null,     // e.g. "45 days from publish"
  "script_due_date": string | null,   // YYYY-MM-DD
  "shoot_date": string | null,        // YYYY-MM-DD
  "edit_done_date": string | null,    // YYYY-MM-DD
  "publish_date": string | null,      // YYYY-MM-DD
  "notes": string | null              // any other relevant context that doesn't fit above
}

Today's date is ${today} — resolve relative dates ("next Friday", "in 2 weeks")
to absolute YYYY-MM-DD using this as the reference point. If a field is not
present in the input, use null — never guess or invent a value. The creator
will review and edit every field before saving, so it is fine to leave things
null when uncertain.`
}
