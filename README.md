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
16. `016_fix_storage_policy_schema.sql` — schema-qualifies the attachments
    storage policy. Hardening only.
17. `017_fix_memberships_recursion.sql` — breaks an infinite recursion in the
    `memberships` policy (42P17), which was 500ing every membership read and
    400ing every Storage call. Not optional.
18. `018_gst_tax_invoice_fields.sql` — the fields Rule 46 of the CGST Rules
    requires on a tax invoice: supplier address, recipient GSTIN and address,
    place of supply, and the tax split by head.
19. `019_stages_contacts_payments_expand.sql` — `deal_stages` and
    `brand_contacts` (both backfilled), part-payment and TDS columns on
    `payments`, and on-hold plus currency columns on `deals`. Purely additive:
    safe to run against a live app, and safe to re-run.

20. `020_deal_status_lifecycle.sql` — collapses deal status from seven values
    to four. Not additive: deploy the matching app build at the same time.
21. `021_payments_per_deal.sql` — drops the `unique` on `payments.deal_id` so a
    deal can carry an advance and a balance. Also not additive: that constraint
    is what makes PostgREST return the payment as an object rather than an
    array, so the build that reads the array ships with it.
22. `022_push_and_stage_reminders.sql` — `push_tokens`, reminders keyed to
    `deal_stages.id`, and the contract half of 019: drops the four date columns
    on `deals` and the three contact columns on `brands`.

Paste each file's contents and click **Run** before moving to the next one.
Every migration from 005 onward is guarded and safe to re-run.

## Push notifications

Reminders are sent by a scheduled server job, not by the device. On-device
scheduling only fires while the app has been opened recently, which meant a
creator who ignored the app for a week silently got nothing.

Three pieces, and all three are needed:

### 1. Deploy the sender

```bash
# 0. Authenticate the CLI. Opens a browser; needed once per machine.
#    Without it, both commands below fail with "Access token not provided".
#    The project itself is already linked (supabase/.temp/project-ref).
npx supabase login

# 1. Generate a secret and PRINT it. You need the same value in step 2.
openssl rand -hex 32

# 2. Give it to the function (paste the value from above).
npx supabase secrets set CRON_SECRET=<paste it here>

# 3. Deploy.
npx supabase functions deploy send-due-reminders
```

Keep that secret somewhere: the cron job in step 2 has to send the identical
string, and there is no way to read it back out of Supabase afterwards. The function authenticates on it rather than on a user's
JWT, because it reads across every workspace with the service-role key.

### 2. Wake it on a schedule

In the SQL editor, once:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-due-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://bbdvgeavtxfxykhiafbp.supabase.co/functions/v1/send-due-reminders',
    headers := jsonb_build_object('x-cron-secret', '<paste the CRON_SECRET here>')
  );
  $$
);
```

Five minutes is deliberate. Reminders fire at 9am local and nobody notices a
sub-five-minute delay on a deadline, while a tighter schedule multiplies
function invocations for no benefit.

### 3. A development build

**Push does not work in Expo Go.** It needs a development build, and iOS
additionally needs an Apple Developer account. Until both exist, the app falls
back to on-device scheduling automatically: `registerPushToken()` returns null,
and `app/_layout.tsx` schedules locally instead. Exactly one of the two runs, so
reminders are never delivered twice.

To check the job is alive:

```sql
select * from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'send-due-reminders')
order by start_time desc limit 10;
```

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

See **[PRODUCT.md](PRODUCT.md)** — the single source of truth for what this
product does, every flow, the data model, roles and permissions, and what is
deliberately out of scope. Each item there is tagged **Built**, **Change** or
**New**, so you can tell what exists from what is still to come.

`DESIGN.md` and `SCREENS.md` used to live here and are gone: they described a
product two rewrites out of date, which is worse than having no document at
all. The design system itself is documented where it is enforced —
`constants/design.ts` and `components/ui/` — because that is the version that
cannot drift from the code.

### 5. Start the app

```bash
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) (iOS or Android), or press
`i` / `a` to open in a simulator.

Web is a first-class target, not an afterthought — the desktop layout is a
genuinely different code path (sidebar, two-column bodies, data tables), so
`npx expo start --web` is worth running alongside the phone.

---

## Seeing what you actually built

`tsc` and the bundler only prove the code compiles. They cannot tell you a
screen rendered blank, a card is missing, or a contrast is unreadable.
`scripts/drive.mjs` opens the running app in a real browser, signs in, drives
it, and saves screenshots.

```bash
npx expo start --web --port 8081          # in another terminal
node scripts/drive.mjs --email you@example.com --password '…' --all
```

| Flag | What it does |
|---|---|
| `--all` | Visits every tab (Work, Money, Brands, You) |
| `--width` / `--height` | Viewport. Defaults to a phone; pass `--width 1440` for desktop |
| `--dark` | Renders in the dark theme |
| `--goto /reminders` | Opens an in-app route after sign-in. Repeatable |
| `--deal` | Opens the first deal, for the detail screen |
| `--search nyka` | Opens the search overlay and runs a query |
| `--tap 'Next'` | Clicks a control and screenshots the result. Repeatable |
| `--prefix v2-` | Prefixes filenames so runs don't overwrite each other |

Screenshots land in `screenshots/` (gitignored — regenerate, don't commit).

**Read the output, not just the exit code.** The driver collects console
errors, failed requests, and every HTTP >= 400 *with its response body*. That
last one matters: Playwright does not treat a 4xx as a failed request, so
without it a broken query surfaces only as a bare
`Failed to load resource: 400` with no URL. Two production bugs in migration
010 — a recursive RLS policy that broke every insert in the app while reads
kept working — were found this way and nowhere else.

---

## Folder structure

```
app/                   expo-router screens
  (auth)/              sign-in and sign-up (no header, redirected if logged in)
  (app)/               protected screens (redirected here once logged in)
components/
  ui/                  the design system — every primitive, exported via one barrel
constants/
  design.ts            design tokens — colors, gradients, spacing, type, radius
  motion.ts            durations, easings and springs
hooks/
  useAuth.ts           reads Supabase session; used by root layout for auth guard
  useTheme.tsx         ThemeProvider — persisted light/dark/system; never useColorScheme() in a screen
  useBreakpoint.ts     the three width tiers and the layout decisions that follow
lib/
  supabase.ts          Supabase client (singleton, uses AsyncStorage for session)
  workspace.ts         cached getWorkspaceId() — on the write path for everything
  aiIntake.ts           client wrappers for the extract-deal / transcribe-audio edge functions
scripts/
  drive.mjs            opens the app in a browser and screenshots it (see above)
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
