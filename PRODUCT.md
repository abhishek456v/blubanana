# CreatorDesk — Phase 1 Product Specification

This is the scope for the FIRST version only. Do not build Phase 2 or Phase 3
features (client reputation score, rate benchmarking, tax/invoicing, multi
platform support, etc.) even if they're mentioned in passing anywhere. If a
request seems to need one of those, flag it instead of building it.

Phase 1 has exactly one job: never miss a deal, never miss a deadline, never
miss a payment.

---

## 0. Required accounts and API keys — set these up BEFORE building

| Service | What it's for | Why this one | Cost |
|---|---|---|---|
| **Supabase** | Database, auth, file storage | One account covers Postgres + login + screenshot/document storage. Fast to set up, generous free tier. | Free tier is enough for Phase 1 |
| **OpenAI** | Voice-to-text (Whisper) AND reading screenshots (GPT-4o vision) AND extracting deal fields from text | One API key covers all three AI features — no need for separate vision/speech providers | Pay-per-use, low cost at this volume |
| **Expo** (if mobile) | Build and push notifications for the app | Needed for push notification reminders | Free for development |

**Recommended shortcut for Phase 1 — WhatsApp sending:**
The product brief specifies WhatsApp Business API via Twilio/Gupshup/Interakt
for automated payment reminders. That requires business verification and
ongoing per-message cost. For Phase 1, I recommend instead generating a
pre-filled `wa.me` link (WhatsApp click-to-chat) with the message text ready
to go — the creator taps it, WhatsApp opens with the message pre-written, she
hits send herself. Zero setup, zero cost, and it still satisfies "she reviews
and approves before anything sends" from the brief. We can upgrade to full
Business API automation in a later phase once the product is validated.

If you'd rather set up real WhatsApp Business API from day one instead, say
so and we'll scope that in — just know it adds signup/verification time
before any code can be tested end-to-end.

**Not needed yet:** Razorpay/Stripe (billing comes after Phase 1 works),
Instagram/YouTube API (performance tracking is Phase 2).

---

## 1. Core data model

Four objects. Keep this simple — don't add fields beyond what's listed unless
a Phase 1 feature explicitly needs it.

**Creator** — the logged-in user. name, email, phone, follower count (manual
entry for now).

**Brand** — a client, reusable across deals. name, contact person, contact
info (phone/email), notes.

**Deal** — one collaboration. Linked to one Brand. Fields: platform
(Instagram Reel / Instagram Feed / YouTube Short / YouTube Long-form /
Podcast / Twitter / LinkedIn / Other), deliverable description, rate (INR),
timeline dates (script due, shoot day, edit done, publish date), status
(intake → script due → shooting → editing → published → payment awaited →
paid), live link (nullable until published), additional notes field,
attachments (contracts/briefs — stored as files in Supabase storage).

**Payment** — linked to one Deal. amount, payment terms (e.g. "45 days from
publish"), due date (calculated from publish date + terms), status (pending /
reminder sent / overdue / paid), paid date (nullable).

---

## 2. Features in scope

### 2.1 Deal intake — three ways in, one shared review step

- **Screenshot upload** → sent to GPT-4o vision → returns structured JSON
  (brand name, deliverable, rate, timeline, payment terms) → shown to creator
  in an editable form before saving. Never save without her confirming.
- **Voice input** → Whisper transcribes → same extraction prompt as above
  turns the transcript into structured fields → same editable review step.
- **Manual entry** → a clean form with the same fields, no AI involved.
- All three converge on the same review/confirm screen. There's one intake
  flow with three entry points, not three separate flows.
- Every deal has an always-visible additional notes field for context that
  didn't come through the automated extraction.

### 2.2 Deal dashboard

One screen, all active deals as flat rows (per DESIGN.md). Each row: brand
name, deliverable, current status, next deadline. Filterable by status,
platform, and payment-due. Tapping a row opens the full Deal detail screen.

### 2.3 Workflow reminders

Each deal generates a reminder sequence from its timeline: script due → shoot
day → editing → publishing → live link submission. Local push notification at
each stage. Creator responds: Done / Remind me in 12 hours / Remind me
tomorrow. The next reminder only fires after she responds to the current one.

### 2.4 Payment tracker and follow-up

Due date is calculated automatically from publish date + payment terms.
Three days before due date: generate a pre-filled WhatsApp message (see
shortcut above) reminding the brand payment is due soon. On the due date, if
still marked pending, generate a second reminder. Creator always taps to send
— nothing sends itself.

### 2.5 Live link submission

When a deal moves to "published," creator enters the live link. This
generates a pre-filled brand-notification message (same wa.me pattern) and
moves the deal to "payment awaited," starting the payment countdown.

---

## 3. Explicitly OUT of scope for Phase 1

Do not build: client reputation scoring, rate benchmarking, revenue
dashboard/analytics, content performance tracking, multi-platform-specific
workflow logic beyond the platform tag itself, tax/invoice/GST handling,
shareable profile card, annual report, Meta Ad Library integration, team/
agency accounts, brand-facing login.

If any of these come up naturally while building Phase 1, note them for later
rather than building them now.

---

## 4. Code quality standards

This codebase needs to be maintainable by another developer later, not just
functional. Follow these rules throughout:

- **TypeScript everywhere**, strict mode on. No `any` unless truly
  unavoidable, and comment why when it happens.
- **Clear folder structure** — separate concerns: `screens/` or `pages/`,
  `components/` (small, reusable, one responsibility each), `lib/` or
  `services/` (API calls, Supabase queries, AI extraction logic),
  `types/` (shared TypeScript interfaces for Creator/Brand/Deal/Payment),
  `hooks/` (custom React hooks).
- **Descriptive naming** — `getDealsByStatus()` not `getData()`. No
  single-letter variables outside of trivial loop counters.
- **Comments explain WHY, not WHAT** — don't narrate obvious code line by
  line; do explain non-obvious decisions (e.g. "using wa.me link instead of
  Business API for Phase 1 — see PRODUCT.md section 0").
- **No giant files** — if a component or file is getting hard to scroll
  through, it's a sign to split it.
- **Environment variables** for every API key and secret — never hardcoded,
  never committed. `.env.example` should list every required variable with a
  placeholder value and a one-line comment on where to get it.
- **A README that actually helps** — setup steps, required env vars, how to
  run it locally, and a short description of the folder structure, so a new
  developer (or future you) isn't guessing.

---

## 5. Build order

Build and get working end-to-end, in this order, before moving to the next:

1. Data model + Supabase setup + basic auth
2. Manual deal entry + dashboard (prove the core loop works with no AI yet)
3. Screenshot and voice intake (adds AI on top of a working foundation)
4. Workflow reminders
5. Payment tracker and WhatsApp message generation
6. Live link submission flow

Confirm each step works before starting the next rather than building
everything in parallel.
