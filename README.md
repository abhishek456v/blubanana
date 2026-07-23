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

Paste each file's contents and click **Run** before moving to the next one.

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
