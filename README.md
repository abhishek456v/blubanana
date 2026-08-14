# CreatorDesk

A mobile CRM for content creators — never miss a deal, a deadline, or a payment.
Built with Expo (React Native) + Supabase + OpenAI.

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in `.env` with your Supabase and OpenAI keys. See `.env.example` for where
to find each value.

### 3. Run the Supabase migrations

Open your [Supabase dashboard](https://supabase.com) → your project →
**SQL Editor**, and run each file in `supabase/migrations/` **in order**:

1. `001_initial_schema.sql` — creates the four tables (`profiles`, `brands`,
   `deals`, `payments`), enables Row Level Security, and sets up the trigger
   that auto-creates a profile whenever a new user signs up.
2. `002_reminders_and_payment_tracking.sql` — adds the reminder-scheduling
   columns the app relies on for workflow and payment reminders (PRODUCT.md
   2.3, 2.4). Skipping this breaks every deal/payment save.
3. `003_reminder_completed_through.sql` — adds `reminder_completed_through`,
   which the workflow-reminder rescheduling logic in `lib/reminders.ts`
   requires.
4. `004_deal_attachments_storage.sql` — creates the private `attachments`
   Storage bucket and its RLS policy for deal attachments (PRODUCT.md 1).
   Skipping this makes the Attachments section on the deal screen fail with
   a permission error.
5. `005_ad_rights.sql` — adds the ad rights columns on `deals` (fee,
   duration, start/expiry dates, reminder notification id). **Required for
   deal creation to work at all** — `createDeal` writes these columns
   unconditionally, so without this migration every deal save fails.
6. `006_phase2_phase3.sql` — Phase 2/3 features: client reputation scoring
   (`brand_ratings` table), rate benchmarking snapshot + manual content
   performance fields on `deals`, tax/GST invoicing (`invoices` table),
   billing/niche/public-profile fields on `profiles`, and the
   `public_creator_profiles` view backing the shareable profile card.
   **Also required for deal creation** — same reason as 005, `createDeal`
   writes `creator_follower_count_at_time` unconditionally.
7. `007_deliverables_and_platforms.sql` — `deal_deliverables`: a deal becomes a
   list of typed line items (reel, story, carousel, ad rights, auto DM) rather
   than one text field. Also removes `podcast` as a platform.
8. `008_invoice_line_items.sql` — `invoice_line_items`, so one invoice can
   cover several deals. Makes `invoices.deal_id` nullable.
9. `009_workspaces_expand.sql` — adds `workspaces` + `memberships` and a
   nullable `workspace_id` on every business table, then backfills. Changes no
   behaviour on its own.
10. `010_workspaces_enforce.sql` — makes `workspace_id` NOT NULL, replaces every
    `creator_id` RLS policy with a workspace-membership one, and forces RLS.
    **Deploy the app before running this**: it makes `workspace_id` mandatory,
    so an older client fails on every insert.
11. `011_workspaces_contract.sql` — drops `creator_id`. One-way: after this,
    010's down script has nothing to fall back on. Run once you trust 010.
12. `012_audit_log.sql` — `audit_logs` plus triggers recording every change to
    a money or status field, including changes made outside the app.
13. `013_social_accounts.sql` — connected Instagram/YouTube accounts and the
    daily reach time series. OAuth tokens are protected by column-level grants,
    so the client cannot read them.
14. `014_outbound_messages.sql` — the outbound message log. Approval before
    sending is enforced by a check constraint, not by application code.
15. `015_reminder_chains.sql` — durable reminder chains. A partial unique index
    enforces one live reminder per chain.

Paste each file's contents and click **Run** before moving to the next one.
Every migration from 005 onward is guarded and safe to re-run.

## Conventions

**Money is a whole number of rupees.** Every money value — `rate`, `amount`,
`total_amount`, `gst_amount`, `tds_amount`, `ad_rights_fee` — is an `integer`
count of rupees. Never a float, and deliberately not paise: integers already
rule out the floating-point errors that rule exists to prevent, and GST is
rounded to the nearest rupee by law (CGST Act s.170), so sub-rupee digits would
be computed and then legally discarded. Revisit at the first non-INR currency,
which is a currency migration rather than a change of scale. Full reasoning is
at the top of `types/index.ts`.

**The tenant is a workspace, not a user.** Every business table carries
`workspace_id`, and isolation is enforced by forced RLS keyed off workspace
membership. Writes go through `getWorkspaceId()` in `lib/workspace.ts`; reads
need no filter because the policies apply one.

**Guarantees live in the database, not in code.** One live reminder per chain,
approval before a message is sent, and tenant isolation are a unique index, a
check constraint, and RLS respectively — so a bug, a retry, or a hand-run SQL
statement cannot bypass them.

**Recommended for development:** in Supabase → **Authentication** → **Email**,
toggle off **"Confirm email"**. This lets you sign up and sign in immediately
without going through an email link. Re-enable it before shipping.

### 4. Deploy the AI intake edge functions

Screenshot and voice-note intake call OpenAI from two Supabase Edge Functions
(`extract-deal`, `transcribe-audio`) so the `OPENAI_API_KEY` never ships in the
client bundle.

```bash
npm install -g supabase   # if you don't have the CLI yet
supabase login
supabase link --project-ref <your-project-ref>   # find this in the dashboard URL
supabase secrets set OPENAI_API_KEY=sk-proj-...
supabase functions deploy extract-deal
supabase functions deploy transcribe-audio
```

Both functions require a valid Supabase auth session by default (no extra
config needed) — only signed-in creators can trigger OpenAI calls.

### Feature scope

**Phase 1** (PRODUCT.md): deal intake (screenshot/voice/manual), dashboard
with status/platform/payment-due filters, workflow reminders, payment
follow-up, live link submission, ad rights tracking + Meta Ad Library link.

**Phase 2/3** (built beyond PRODUCT.md's original scope, on request):
client reputation scoring, simplified rate benchmarking (follower-count
snapshot, not live engagement), a Revenue tab, manual content performance
entry, GST/TDS invoicing with PDF export, an annual report, and an opt-in
shareable public profile card at `/creator/<slug>`.

**Deliberately not built:**
- **Niche-based rate intelligence** — needs aggregated data across many
  creators to be meaningful; with one user there's no population to
  benchmark against.
- **Live Instagram/YouTube performance sync** — needs OAuth app credentials
  (Meta app, Google Cloud project) that haven't been set up. Content
  performance is manual-entry only until that exists.
- **Automated Meta Ad Library monitoring** — the deal screen has a one-tap
  link to a pre-filled Ad Library search; polling the real Ad Library API
  for expired-rights violations is a separate, later decision.

### 5. Start the app

```bash
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) (iOS or Android), or press
`i` / `a` to open in a simulator.

---

## Folder structure

```
app/                   expo-router screens
  (auth)/              sign-in and sign-up (no header, redirected if logged in)
  (app)/               protected screens (redirected here once logged in)
constants/
  design.ts            design tokens from DESIGN.md — colors, spacing, type, radius
hooks/
  useAuth.ts           reads Supabase session; used by root layout for auth guard
lib/
  supabase.ts          Supabase client (singleton, uses AsyncStorage for session)
  aiIntake.ts           client wrappers for the extract-deal / transcribe-audio edge functions
supabase/
  migrations/          SQL files — run manually in Supabase SQL editor
  functions/
    extract-deal/       GPT-4o extraction — screenshot (vision) or voice transcript in, deal fields out
    transcribe-audio/   Whisper transcription for recorded voice notes
    _shared/             CORS headers + the extraction prompt shared by both intake paths
types/
  index.ts             TypeScript interfaces for all four data-model objects, plus ExtractedDealFields
```

---

## Required environment variables

| Variable | Where to find it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `OPENAI_API_KEY` | platform.openai.com → API keys |

`EXPO_PUBLIC_*` variables are bundled into the client. The others are server-side
only (Edge Functions / scripts) — never reference them in app code.
