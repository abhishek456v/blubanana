// Shared between extract-deal's image and transcript paths. PRODUCT.md 2.1
// requires "same extraction prompt" for both intake methods so results are
// consistent regardless of entry point.

export const VALID_PLATFORMS = [
  'instagram_reel',
  'instagram_feed',
  'instagram_story',
  'youtube_short',
  'youtube_long',
  'twitter',
  'linkedin',
  'other',
] as const

export const VALID_DELIVERABLE_KINDS = [
  'reel',
  'story',
  'carousel',
  'static_post',
  'yt_short',
  'yt_long',
  'yt_integration',
  'live',
  'ad_rights',
  'auto_dm',
  'other',
] as const

export interface ExtractedDeliverable {
  kind: (typeof VALID_DELIVERABLE_KINDS)[number]
  quantity: number
  description: string | null
  rate: number | null
}

// Kept in sync with ExtractedDealFields in types/index.ts. Duplicated here
// (rather than shared across the Deno/Node boundary) because edge functions
// bundle independently of the app's TypeScript project.
export interface ExtractedDealFields {
  brand_name: string | null
  platform: (typeof VALID_PLATFORMS)[number] | null
  deliverable_description: string | null
  /** Itemised breakdown. Empty when the message describes only one thing. */
  deliverables: ExtractedDeliverable[]
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
  return `You extract structured brand-deal information for an Indian content creator's CRM.
The input is either a screenshot of a brand's message/brief, or a transcript of
a voice note the creator recorded describing a new deal.

Return ONLY a JSON object with exactly these fields, with no prose and no markdown:

{
  "brand_name": string | null,        // the brand/company name, e.g. "Nykaa"
  "platform": string | null,          // primary platform, one of: ${VALID_PLATFORMS.join(', ')}; null if unclear
  "deliverable_description": string | null,  // short human summary, e.g. "1 Reel + 3 Stories"
  "deliverables": [                   // itemised breakdown; [] if genuinely unclear
    {
      "kind": string,                 // one of: ${VALID_DELIVERABLE_KINDS.join(', ')}
      "quantity": number,             // integer >= 1
      "description": string | null,   // e.g. "60-second reel for the moisturiser"
      "rate": number | null           // per-line INR if the message prices items separately, else null
    }
  ],
  "rate": number | null,              // TOTAL deal value, plain integer INR, no symbols/commas/decimals
  "payment_terms": string | null,     // e.g. "45 days from publish"
  "script_due_date": string | null,   // YYYY-MM-DD
  "shoot_date": string | null,        // YYYY-MM-DD
  "edit_done_date": string | null,    // YYYY-MM-DD
  "publish_date": string | null,      // YYYY-MM-DD
  "notes": string | null              // any other relevant context that doesn't fit above
}

INDIAN CREATOR SHORTHAND: the input is usually Hindi-English code-mixed, full
of abbreviations and emoji. Read it the way the creator would:
  - "15k" / "15K" / "15 thousand" → 15000. "1.5L" / "1.5 lakh" → 150000.
  - "45 din me payment" / "45 days me" → payment_terms "45 days from publish".
  - "reel + 2 stories" → two deliverables: reel ×1, story ×2.
  - "1 static" / "1 post" → static_post. "carousel" / "3 slides" → carousel.
  - "collab post" on Instagram → static_post unless a video is described.
  - "integration" / "dedicated video" on YouTube → yt_integration / yt_long.
  - "whitelisting", "ad rights", "paid amplification", "usage rights",
    "spark ads", "boosting" → an ad_rights deliverable. Put the duration in
    its description, e.g. "6 months".
  - "auto DM", "comment-to-DM", "ManyChat", "DM automation" → auto_dm.
  - "barter" / "PR only" / "gifting" → rate 0, and say so in notes.

Set "rate" to the TOTAL the creator receives. If the message prices each item
separately, also fill each deliverable's own "rate"; the individual rates
should add up to the total.

Today's date is ${today}. Resolve relative dates ("next Friday", "agle
hafte", "in 2 weeks") to absolute YYYY-MM-DD using this as the reference
point. If a field is not present in the input, use null, and never guess or
invent a value. The creator reviews and edits every field before saving, so
leaving something null when uncertain is always better than guessing.`
}
