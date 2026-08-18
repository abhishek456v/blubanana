# CreatorDesk — Product Specification

**This is the single source of truth.** It supersedes the earlier `PRODUCT.md`
(which scoped a Phase 1 that has long since been overtaken), `DESIGN.md` and
`SCREENS.md`. Those three are deleted. `README.md` remains, as the developer
entry point only.

Every item below is tagged so you can tell what exists from what doesn't:

| Tag | Meaning |
|---|---|
| **Built** | Working in the app today |
| **Change** | Exists, but this spec changes it |
| **New** | Not built yet |

When the product changes, this file changes in the same commit. A decision that
lives only in a chat log is a decision that will be lost.

---

## 1. What CreatorDesk is

A business-management app for Indian content creators. It replaces the
spreadsheet, the notes app and the mental arithmetic a creator uses to run
brand collaborations.

It makes three promises:

1. **Never miss a deal** — a collaboration takes about thirty seconds to log,
   from a screenshot, a voice note, or by typing.
2. **Never miss a deadline** — every stage of every deal has a date, and the
   phone reminds her before it passes.
3. **Never miss a payment** — the app knows what she is owed, when it is due,
   how late it is, and hands her the message to chase it.

Everything else in this document is in service of one of those three.

### What it deliberately is not

- **Not a payment processor.** Brands pay creators directly, bank to bank.
  Money never flows through the platform. Doing otherwise would make the
  business a payment intermediary and require RBI Payment Aggregator
  licensing — a different company entirely.
- **Not a content publishing tool.** It never posts anything.
- **Not an approval workflow.** There is no "brand approved the draft" state.
  Creators are trying to spend less time on admin, not more.

---

## 2. Who it is for

The **creator** — a solo Indian content creator on Instagram and/or YouTube,
running somewhere between two and twenty brand collaborations at a time. She
handles her own deals, her own invoices and her own chasing.

Optionally, her **manager** — someone she invites into her workspace with
explicitly granted access. See §7.

Each creator's workspace is completely isolated. No creator can ever see
another creator's deals, brands, rates, contacts or earnings. The only data
that ever crosses that boundary is anonymous, aggregated brand reputation
(§8.10), and only above a threshold.

---

## 3. Business model

**New** — none of this is built.

### Trial

- **14 days**, and always the full 14. Creating deals does not shorten it.
- **Maximum 3 deals** during the trial. Everything else is unlimited.
- Hitting 3 deals does **not** end the trial — she keeps every other feature
  for the remaining days.

### After the trial

The workspace goes **read-only**:

- All her data stays visible.
- Every action that creates or edits is greyed out.
- A prompt offers two things and only two: **Buy a plan**, and
  **Export my data**.

Locking a creator out of her own records is hostile, and it makes the export
she is entitled to impossible. Read-only is the correct end state.

### Plans

Paid monthly, quarterly, half-yearly or yearly, via **Razorpay** — the right
choice for India because it covers UPI, cards and netbanking, and supports
recurring mandates. Stripe is weak for domestic Indian payments.

Razorpay is used for **one thing only**: the creator paying CreatorDesk. It is
never involved in brand-to-creator money.

### GST on our own revenue

CreatorDesk sells a SaaS subscription to Indian customers and therefore owes
GST on it, and must issue a GST invoice to each subscriber — carrying their
GSTIN where they have one. This is a separate billing system from the invoices
creators raise to brands, even though the tax logic is similar.

---

## 4. Surfaces

| Surface | What it is | Status |
|---|---|---|
| **Marketing website** | Public. What the product does, pricing, sign-up, privacy policy. Sends people to the platform | **New** |
| **Platform** (`platform.<domain>`) | The web app. This is the existing Expo web build | **Built** |
| **iOS / Android apps** | Same codebase, from the App Store and Play Store | **Built**, not yet published |

The apps and the platform are one codebase (Expo + React Native Web). The
marketing website is separate and simple.

There is **no public creator page**. The profile card (§8.11) is a shareable
artefact, not a hosted URL.

---

## 5. Vocabulary

The words below are the product's words. Use them exactly, in UI and in code.

**Deal statuses** — Active · Live · Unpaid · Paid. The lifecycle only; the
work is described by a deal's stages, under whatever names its creator gave
them (§8.5).

**On hold** — a flag, not a status. Any deal can be put on hold (§8.6).

**Payment statuses** — Pending · Nudged · Overdue · Paid

**Platforms** — Instagram Reel, Instagram Post, Instagram Story, YouTube Short,
YouTube video, X, LinkedIn, Other

**Roles** — Creator (owner) · Manager

Money is always in Indian rupees with Indian digit grouping — ₹1,00,000, never
₹100,000 — except where a deal is explicitly in a foreign currency (§8.7).

---

## 6. Data model

### Existing tables

`workspaces`, `memberships`, `profiles`, `brands`, `deals`, `payments`,
`deal_deliverables`, `invoices`, `invoice_line_items`, `reminders`,
`brand_ratings`, `social_accounts`, `creator_stat_snapshots`,
`outbound_messages`, `audit_logs`

### Changes required

Split across an expand migration (`019`, additive, already written) and a
contract migration (`020`, ships with the code that needs it). See §11.

| Table | Change | When | Why |
|---|---|---|---|
| `deals` | **Add** `on_hold`, `on_hold_at`, `currency`, `rate_original`, `fx_rate` | 019 | §8.6, §8.7 |
| `deals` | **Collapse** `status` to four lifecycle values | 020 | Stages describe the work now — §5 |
| `deals` | **Add** retainer fields | Step 6 | §8.15 |
| `deals` | **Removed** the four fixed date columns | 022 | Stages are user-defined — §8.5. Held until reminders stop reading them (step 3) |
| `payments` | **Add** `amount_received`, `tds_amount`, `label`, `sort_order` | 019 | Invoiced ≠ received — §8.7 |
| `payments` | **Drop the `unique` on `deal_id`** | 021 | A deal can have several payments. Flips PostgREST's embed from object to array, so it shipped with the code that reads the array |
| `brands` | **Removed** `contact_person`, `contact_phone`, `contact_email` | 022 | Superseded by `brand_contacts`. Still written from the primary contact, because invoices, search and the WhatsApp nudges read them |
| `memberships` | **Add** per-area permission flags | Step 5 | §7 |

`deals.rate` keeps its meaning throughout: always the INR figure, so every
existing query, report and total is unaffected by the currency work.

### New tables

| Table | Holds |
|---|---|
| `deal_stages` | name, order, due date, done, done_at — one row per stage per deal (**019**) |
| `brand_contacts` | many POCs per brand: name, phone, email, role, is_primary (**019**) |
| `push_tokens` | Expo push tokens per user per device (**022**) |
| `subscriptions` | plan, period, Razorpay ids, status, trial dates |
| `expenses` | date, category, amount, note, receipt attachment (**023**) |
| `brand_aggregates` | anonymous cross-tenant reputation — **no creator identifiers** |

`brand_aggregates` carrying no creator identifier is not an implementation
detail. It is what makes the table safe to read across tenants at all.

---

## 7. Roles and permissions

**Built** — invite UI in Settings → Team; every switch enforced in the
database (migrations 024 and 025).

### Creator (owner)

Everything. The only role that can **delete** anything.

### Manager

Invited by the creator. **A creator can invite several.**

At invite time the creator chooses, per area, what this manager can see:

- Deals and deadlines
- Brands and contacts
- Rates and commercials
- Invoices
- Money dashboard and reports
- Expenses
- Bank and billing details

A fully-trusted manager gets everything switched on. A production assistant
gets deals, deadlines and contacts, with **every amount masked**.

### The delete rule

**No manager can delete anything, ever** — no deals, no payments, no invoices,
no brands. Regardless of what is switched on. This is enforced in the database
with row-level security, not in the UI, so it holds even against a direct API
call.

The policy must be `AS RESTRICTIVE`. A permissive delete policy is OR'd with
the `for all` workspace policy every one of these tables already carries, so it
grants a second route to the delete rather than removing the first — which is
exactly what 023 shipped and 024 corrected.

**Every switch is a database boundary, not a UI one.** Six are row filters. The
seventh, rates, is a column on `deals`, which RLS cannot mask: 025 revokes the
commercial columns outright and serves them through `deals_secure`, a view that
nulls them per row. A withheld rate therefore arrives as `null` rather than as
a number the screen declines to draw — so anything totalling rates must
propagate the null rather than coalesce it to zero, which would silently
understate a figure the reader believes is complete.

---

## 8. How it works

### 8.1 Signing up — **New**

Sign up on the website or in the app → 14-day trial starts immediately → she
lands in an empty workspace. No card required to start.

### 8.2 Onboarding, and importing what she already has — **Built**

A creator arriving has live deals already. If day one is "type in all eight",
she leaves.

So onboarding offers to **import**: point the existing screenshot intake at a
spreadsheet, a screenshot of her notes, or an exported CSV, and pull the deals
in. The extraction already exists (§8.3); this is wiring it to a different
starting point.

Everything in onboarding is skippable. Nothing is mandatory.

Built as `extract-deals`, the bulk sibling of `extract-deal`, plus an import
screen reachable from the end of onboarding **and** from Settings — the creator
most likely to need it later is exactly the one who skipped past the offer.

Nothing saves without review, matching §8.3's rule for every AI path: a misread
column becomes eight deals with the wrong money in them, and unpicking that by
hand is worse than never importing. Imported deals go through `createDeal` and
get the default stages, so they arrive with deadlines and reminders rather than
as inert rows. A rate the sheet did not state is 0, not a guess — it reads as
"not recorded" everywhere, where an invented figure would read as fact.

### 8.3 Getting a deal in — **Built** (plus one new mode)

Four ways to start, all landing on the same form:

| Mode | How | Status |
|---|---|---|
| **Screenshot** | Photograph or upload a brand DM/email. GPT-4o vision extracts the fields | **Built** |
| **Voice** | Talk it through. Whisper transcribes, then the same extractor reads it | **Built** |
| **Type** | Fill the form directly | **Built** |
| **Repeat** | Copy the terms of a previous deal | **Built** — §8.4 |

Screenshot and voice **never save silently**. They fill the form and show it
for review, so she can correct anything the model got wrong before saving. The
model proposes; she decides.

Both run through Supabase edge functions (`extract-deal`, `transcribe-audio`).

The form captures: brand, contact, platform, deliverables, rate, payment terms,
stages and their dates, notes, attachments, and the two toggles — **ad rights**
(§8.14) and **retainer** (§8.15).

Nothing on this form is mandatory except the brand. And no field is ever
labelled "optional" or "required" — if it can be left blank, leaving it blank
is simply allowed.

### 8.4 Repeating a deal — **Built**

A duplicate button on every row would be useless: with ten deals on screen,
which one?

Instead **Repeat** is a fourth intake mode, because that is the moment she is
thinking "this is like the last one".

Tapping it lists **one row per brand** — that brand's most recent deal, most
recent brands first. Ten deals across four brands is four rows.

Picking one pre-fills the **terms**: brand, contact, platform, deliverables,
rate, payment terms, ad rights and retainer settings.

It deliberately does **not** copy: stage dates, live link, notes, attachments,
payment status. Those belong to the job, not the arrangement, and copying them
produces a deal that claims it published last month.

There is a second entry point: **"New deal with [brand]"** on a brand's page,
which skips the picker.

### 8.5 Stages and deadlines — **Built**

Today a deal has four fixed stages in four fixed database columns: Script,
Shoot, Edit, Publish. That is wrong. Creators work differently — some script
and shoot the same day, some have a client-review round, some have three edit
passes.

**Stages become user-defined per deal.**

- A new deal starts with the four defaults, because they fit most people.
- Each stage row is: **name · due date · done**.
- Any stage can be **renamed**, or **removed** with a clear button.
- **"+ Add stage"** appends a new one, with its own name and date.

This is why the four date columns come out of `deals` and become the
`deal_stages` table. It is the single largest structural change in this spec,
and everything about reminders depends on it.

### 8.6 When a deal stalls — **Built**

Deals die. Brands ghost, budgets get pulled, campaigns get shelved.

Any deal can be put **On hold** — a small marker on the deal, no reason codes,
because she usually does not know the reason and asking her to pick one is
friction for no gain.

**A held deal stops counting as expected income.** It leaves "Still out" and
every money total, while staying fully visible under its own filter and in the
brand's history. Without this, the one number the app exists to get right
slowly fills with deals that are never going to pay.

Un-holding puts it back.

### 8.7 Money in — **Change**

**Payment terms** are captured on the deal: the amount, and when it is due.

**Advances and part-payments** — **Built.** Until migration 021 the schema
allowed exactly one payment per deal. But *50% advance, 50% on delivery* is the most common
arrangement in Indian creator work. A deal can now carry several payments, each
with its own amount, due date and status.

**Marking a payment received** — **Built.** This is where the numbers get lied
to, so it gets a deliberate, attention-taking dialog rather than a quiet
toggle. It asks what **actually landed**, which is often not what was invoiced:

> Invoiced ₹1,00,000
> **Received** ₹90,000
> **TDS withheld** ₹10,000

Without this, either the deal looks underpaid forever, or she records ₹90,000
and her income reports understate gross by exactly the TDS figure she needs at
tax time.

**Foreign currency** — **Change.** The columns exist (019); the UI to pick a
currency does not. A deal can be denominated in another currency.
The original amount is stored **and** an INR value snapshotted at the time of
entry. Tax reporting must be in INR, and last year's dollar deal cannot be
revalued at today's rate.

**Chasing** — **Built.** Payments escalate Pending → Nudged → Overdue. At each
level the app drafts a message appropriate to that level and hands it to
WhatsApp as a pre-filled `wa.me` link addressed to the brand's contact. She
reads it and sends it herself. Nothing is ever sent automatically.

**Collection rate** — **Built.** Of everything invoiced this year, what
percentage actually arrived, and how long it took on average. No creator tracks
this, and it is the number that tells her which brands to stop working with.

### 8.8 Invoicing — **Built**, with changes

Invoices are GST-compliant to **Rule 46 of the CGST Rules**, with the
CGST+SGST versus IGST split derived correctly from place of supply.

**Not every creator charges GST.** Unregistered creators get a clean non-GST
invoice with no tax fields at all — not a GST invoice with zeroes in it.

**Generating and editing** — **Change.** An invoice is generated from data the
app already holds, then opened in an **Edit invoice** form where every field
can be adjusted before it is finalised. The form pulls from three places:

| Data | Comes from |
|---|---|
| Brand name, address, GSTIN | The brand record |
| Creator name, address, PAN, GSTIN, bank details, UPI ID | The creator's profile |
| Line items, description, rates, dates | The invoice form |

**UPI QR code** — **Built.** The invoice carries a QR generated from the
creator's UPI ID. The brand scans it and pays her directly, bank to bank.
Money never touches the platform, so this needs no licensing and costs nothing.
The code encodes the **net payable** — after TDS, not the invoice total — so
the brand scans and pays the figure it actually owes. Absent, rather than
broken, when no valid UPI ID is on the profile.

**Sending** — **Built.** One tap opens WhatsApp to the brand's primary contact
with the invoice's number, amount and due date already written, and logs it to
the deal's message history as `invoice_delivery` (027).

It does **not** attach the PDF, and cannot: a `wa.me` link carries text only,
and attaching a file needs the WhatsApp Business API that §0 rules out. So the
message says the PDF is coming and the Share button sends it into the chat that
just opened. Two taps rather than one, against export-then-find-the-chat-then-
attach — and the brand is never left reading "here's my invoice" with nothing
attached.

**The template is a design job in its own right.** A single A4 page, and it is
the only thing a brand's finance team ever sees from this product. It must look
considered — not a generic template, and emphatically not a default.

### 8.9 Reminders and notifications — **Built**

Reminders were scheduled **on the device**, which is why they died when the app
was not opened and never worked on the web. They are now sent by a scheduled
server job:

- `push_tokens`, upserted on every signed-in launch. The token is reissued by
  the OS on reinstall, so it is never trusted from a previous run.
- `send-due-reminders`, an edge function woken every five minutes by `pg_cron`.
- Reminders keyed to `deal_stages.id`, so a renamed or added stage is
  remindable. The old fixed enum could not express one.

Two practical constraints: iOS push needs an **Apple Developer account**, and
push **cannot be tested in Expo Go** — it needs a development build. Until both
exist the app falls back to on-device scheduling automatically, and exactly one
of the two mechanisms runs, so nothing is ever delivered twice.

Setup steps are in `README.md`.

**Categories**, each independently toggleable:

- A stage is due
- A payment is due
- A payment is overdue
- Rate benchmark suggestion (at most one a week, and only when the gap is
  material — otherwise it becomes noise and she mutes everything)
- Ad rights expiring
- Tax and GST deadlines

Web notifications are supported and off by default.

#### The privacy rule

**No notification ever contains an amount.**

*"Zomato payment is overdue"* — never *"Zomato payment of ₹45,000 is overdue"*.
Lock-screen previews are visible to anyone standing near the phone, and a
creator's rates are the most sensitive thing this app holds.

One setting overrides it — **"Show amounts in notifications"**, default
**off** — because it is her phone and some people want the figure.

### 8.10 Brand reputation — **Built**, with a new aggregate layer

Two systems that must not be confused.

**Her own history — always visible, no threshold.** She rates a brand after a
deal: did they pay on time, were they easy to work with, how many revision
rounds, would she work with them again. When she next starts a deal with that
brand, the app tells her what she recorded last time. It is a private note to
herself.

**Combined ratings — hidden until enough people have rated.** **New.**

| Rule | Value |
|---|---|
| Minimum independent creators before a brand has a score | **5** |
| What is shown | A score and the sample size |
| What is never shown | Individual reviews, free text, rates, who rated |
| Rates in aggregates | **Never** |

Below five raters, nothing is shown at all — one bad experience must not be
allowed to define a brand.

A scheduled job computes these into `brand_aggregates`, which carries **no
creator identifiers**, which is what makes it safe to read across tenants.

**Publication is Phase 2.** The plan is a weekly in-app list — *"Top brands to
work with"* — names only, no explanations, no per-brand ratings, and **no
worst-list ever**. Publishing a "worst brands" ranking invites defamation
claims and helps nobody.

### 8.11 The profile card — **Built**, as a card

This is **not** a public web page. Settings → **Rate card** builds a two-sided
A5 card and shares it through the same PDF path as the invoice.

**The existing public web page at `/creator/[slug]` is still there** and is the
implementation this section calls wrong. Removing it is a separate decision:
it means retiring `public_profile_enabled` and `public_share_slug` too.

It is a **shareable card** — the thing a creator sends when a brand says
"share your commercials". Today she assembles that by hand from Instagram
Insights every single time.

Front and back. It carries:

- Photo, name, handle
- Follower count
- Engagement rate
- **Her rates** — per Reel, per Story, per video, per podcast
- **Cost per view (CPV)**
- Contact details

**It must pull live stats.** Once Meta Graph API is connected, followers,
engagement and CPV refresh automatically. A card she has to maintain by hand
goes stale within weeks, and a stale card sent to a brand is worse than none.

Nothing on the card is a field she maintains. **Rates are the median of what
she has actually charged** for each deliverable, drawn from her own line items
— the median rather than the mean, because one unusually large deal drags an
average to a price she has been paid exactly once and cannot defend in a
negotiation. The sample size is stated on the card, which is what makes the
figure a fact rather than an aspiration.

Until Meta and YouTube credentials land the card says the reach figures were
entered by hand, rather than passing them off as measured.

**Photos** (032). Up to three, kept so she has a different shot for a fashion
brand than for a tech brand, one marked as the card's. The three-photo limit is
a database trigger, not a UI check. The bucket is private and the image travels
inside the shared document as a data URI, since a signed URL would expire in a
PDF forwarded to a brand's finance team.

**Themes** (`constants/cardThemes.ts`). Seven, suggested from her niche by
substring match on the free-text field, changed with a picker, and the choice
persists — it is a preference, not one of the per-share edits. Every theme is
CSS: the card is printed as often as it is viewed, and the photograph on it
should be hers rather than stock.

**Everything is editable before sending**, including the labels and the
paragraph, and every field is free text — "₹25–35K" and "From ₹25,000 + travel"
are things creators say that a form of number inputs cannot express. Edits
apply to that share only; the card is rebuilt from live data next time it
opens, so a figure adjusted for one negotiation cannot follow her into a later
one silently.

**AI fills gaps, never revises** (`suggest-rates`). For a format she has never
charged for, the model proposes a starting price — passed what she already
charges so a suggested Story does not come back above her real Reel. Proposals
appear in the editor for review and reach the card only when she adds them.

**One gap left.** CPV needs view counts on line items, which most deals do not
carry yet; the card omits it rather than printing a blank. Meta Graph API is
the real source, and waits on credentials (§12).

She can share it straight to WhatsApp or download it.

### 8.12 Expenses — **Built**

Optional, and simple: date, category, amount, note, and a receipt image.
Editor salaries, cameraman fees, script writers, equipment, travel.

Free-text entry can be parsed by the same AI extraction used elsewhere.

Expenses feed the annual report, which is what turns "turnover" into "taxable
income".

### 8.13 Tax — **Change**

**Deadline reminders.** **Built** (029) — a nightly database job writes them
into `reminders`, so the existing sender delivers them alongside everything
else rather than through a second pipeline with its own quiet-hours logic to
drift. Advance tax lands 7 days ahead; GST filings 3, because they recur twelve
times a year and a week's notice on that is noise. GST reminders go only to
creators with a GSTIN on their profile. Indian freelancers pay **advance tax quarterly** —
15 June, 15 September, 15 December, 15 March — and missing it means interest
under sections 234B and 234C. Most creators find out from their CA in March.
Registered creators also file **GSTR-1** (11th) and **GSTR-3B** (20th) monthly.

The notification says only: *"Advance tax due 15 September."* No amounts —
see the privacy rule in §8.9. It also cannot state a figure honestly, because
the app only knows the income that passed through it; she may have income it
never saw.

**Tax calculator.** **Built.** In-app, and she drives it. It offers her own data — income
and expenses over a period she chooses — as a starting point, she adjusts and
adds anything the app does not know about, and it computes what she should set
aside. A calculator she feeds is honest. A notification that guesses is not.

**Annual report** — **Built**. Reports gross and net now that expenses exist.
Still to do: making it **editable**. The Indian financial year,
April to March, with income, TDS and GST. It reports **gross and net**, so
"tax-ready" means taxable income rather than turnover. Creators need to adjust
figures their app never saw, so the report is editable before export.

### 8.14 Ad rights — **Built**

A toggle on the deal. Off by default; when on it captures the fee, the
duration, and the start date — and derives the expiry from those rather than
asking for it twice. A reminder fires before it expires, and a link opens the
Meta Ad Library so she can check whether the brand is still running the ad.

### 8.15 Retainers — **Built**

A second toggle on the deal. Many brands sign six- or twelve-month retainers
with a monthly deliverable count — "four Reels a month for six months".

When on it captures the contract length, the per-period deliverable count and
the per-period fee, and generates the recurring deals and payment schedule
rather than making her log twelve near-identical deals by hand.

### 8.16 Rate benchmarking — **Built**

Watches what she charges across her deals against her actual reach, and tells
her when she is underpricing. Delivered both in-app and as a notification, at
most weekly.

This is the only feature in the product that makes her money rather than
saving her time.

### 8.17 Content performance — **Built**, pending credentials

Views, likes, comments and saves per deliverable.

**Instagram is built against the real Graph API** (033). `lib/social` picks the
real provider when `EXPO_PUBLIC_META_APP_ID` is set and the mock when it is
not, so credentials are the entire switch — no code changes on the day they
arrive. The nightly `social-sync` writes a reach snapshot and matches each
deliverable's `live_link` to a post permalink to fill in its view count, which
is what makes CPV on the rate card computable at all.

**YouTube stays mocked.** It is Google's API, not Meta's, and a second OAuth
integration is its own piece of work.

Until a platform is live the UI says its figures are manual, per platform
rather than globally — Instagram being real must not make YouTube's sample
numbers look measured.

### 8.18 Export and deletion — **New**

**Export.** **Built.** Everything she has — deals, brands, payments, invoices, expenses,
ratings — as CSV and JSON. Available at any time, including during the
read-only state after a lapsed trial or subscription.

**Delete my account.** **Built.** A real deletion path, not a cancellation. This is a
legal obligation, not a courtesy: CreatorDesk stores brand contacts' names and
phone numbers, which is **third-party personal data**, making the business a
Data Fiduciary under India's **Digital Personal Data Protection Act 2023**.
The marketing site needs a privacy policy for the same reason.

Deleting the auth user is not sufficient and was never going to be. `workspaces`
has no owner column, so the cascade from `auth.users` stops at `memberships`
and leaves the workspace — and everything in it a manager created — behind. The
`delete-account` edge function deletes the owned workspaces first, which is what
actually clears the data, and removes the stored files, which have no foreign
keys and so cascade from nothing.

No row reassignment is needed on the way: attribution has been `workspace_id`
alone since 011 dropped the `creator_id` columns, so a departing *manager*
takes nothing of the creator's with them. 028 records that, and fails if a
`creator_id` is ever reintroduced without deletion being revisited.

### 8.19 Working offline — **New**, native only

The promise is "log a deal in thirty seconds", and the moment that matters most
is on a shoot, in a basement studio, with no signal. Today that fails outright.

**In scope — offline capture.** Creating a deal, adding a brand, marking a
stage done, and starting an intake all write to a local queue first and sync
when signal returns. She never sees a failure. Screenshots and voice notes
queue too; extraction runs on sync.

**Out of scope — offline everything.** Dashboards, invoices, reports and search
still need a connection. Those are things you sit down to do.

Roughly 20% of the work of true offline, covering the moment that matters.

---

## 9. Screens

| Screen | Purpose | Status |
|---|---|---|
| Sign in / Sign up / Forgot / Reset | Auth | **Built** |
| Plan & checkout | Trial state, plans, Razorpay | **New** |
| Onboarding | Profile basics, import existing deals | **Change** |
| **Home** | What is owed, what arrived, who pays. Needs-you list, deal list | **Built** |
| **Work** | Everything shipped: archive and performance | **Built** |
| **Money** | Still out, received, this month, unpaid deals, invoices, reports | **Built** |
| **Brands** | The roster, with reputation | **Built** |
| **You** | Profile card, banking, plan, expenses, notification settings, appearance, export, delete account | **Change** |
| Deal detail | The work · the money · the paperwork | **Built** |
| New deal | Four intake modes | **Change** |
| Brand detail / Add brand | Contacts, history, ratings | **Change** |
| Reminders | What is scheduled | **Built** |
| Invoices / New invoice / Invoice detail | List, edit form, preview | **Change** |
| Printed invoice | A4 template — its own design job | **Built** |
| Year in review | Editable annual report | **Change** |
| Tax calculator | Advance tax instalments | **Built** |
| Expenses | Log and categorise | **Built** |
| Profile card | The shareable card | **Change** |
| Manager invite | Invite, set per-area access | **New** |

---

## 10. Out of scope

Stated so nobody re-proposes them:

- **Brand-to-creator payment processing** — regulatory burden, and brands will
  not pay through a creator's tool. The UPI QR on the invoice is the answer.
- **Deliverable approval workflow** — no "brand approved the draft" state. It
  is admin, and this product exists to reduce admin.
- **Publishing content** — the app never posts.
- **A public worst-brands list** — defamation risk, helps nobody.
- **Full offline** — see §8.19.

---

## 11. Build order

Sequence matters: several of these touch the same tables, and doing them out of
order means migrating twice.

Schema work follows the **expand → contract** pattern already used by
migrations 009 to 011: add and backfill first, in a migration that leaves the
running app untouched; drop the old shape only once the code has moved off it.

**1 — Schema foundations (expand).** `019_stages_contacts_payments_expand.sql`.
Creates `deal_stages` and `brand_contacts` and backfills both; adds
`amount_received`, `tds_amount`, `label` and `sort_order` to `payments`; adds
`on_hold`, `on_hold_at`, `currency`, `rate_original` and `fx_rate` to `deals`.
Purely additive, so it can be run at any time against the live app.

One thing deliberately **not** in it: dropping the `unique` on
`payments.deal_id`. That constraint is the only reason PostgREST returns
`payment:payments(...)` as an object rather than an array, and every screen
reads `deal.payment?.…`. Removing it without the code change turns every
payment read into `undefined` — silently, with no error. It comes off in step 2.

**2 — The screens those break. Done.** Deal detail's stage editor, new deal,
the payment schedule with per-instalment settlement, the received/TDS dialog,
Money's totals respecting on-hold, the on-hold control, and multiple brand
contacts.

`020_deal_status_lifecycle.sql` shipped as part of this and is **not**
additive: it collapses deal status from seven values to four. Building the
stage editor made the old status enum incoherent — four of its seven values
were the four fixed stages, so a renamed stage left the pill lying and an added
stage had no status to occupy. Status now describes only the lifecycle
(§5); the stages describe the work. Code and migration deploy together.

The remaining drops move to `021`, which ships with step 3: the `unique` on
`payments.deal_id`, the four date columns on `deals`, and the three contact
columns on `brands`. The date columns in particular cannot go until reminders
are rekeyed, which is step 3's job — see below.

**3 — Push notifications, and rekeying reminders. Done.** `push_tokens`, the
`pg_cron` job, the send function, reminder scheduling moved server-side, and
reminders rekeyed to `deal_stages.id`.

`022` also dropped the legacy columns, since this step removed their last
readers: the four date columns on `deals` and the three contact columns on
`brands`. `lib/reminders.ts` is gone with them — it was a second, parallel
scheduler keyed to those columns, and the durable chain in
`lib/reminderChains.ts` now owns the schedule outright.

**4 — Subscriptions.** `subscriptions`, Razorpay integration, the trial gate,
read-only state, our own GST invoicing.

**5 — Roles. Done.** Membership permission flags, the invite UI, and RLS
enforcement — of the delete rule, of the six row-scoped areas, and of rates via
the masking views. `024` and `025`.

The delete rule needed correcting rather than adding: 023's policies were
permissive, so they widened the right they were written to remove. §7.

**6 — The additions.** Done: repeat a deal, expenses, the advance-tax
calculator, collection rate, export. `023` also carries the schema for
retainers and per-area manager access.

Retainers shipped: a toggle on the new-deal screen captures the length and the
per-month deliverable count, and the remaining months are generated as copies
of month one — its stages and line items, each shifted a month — so every
existing list, total, reminder and invoice works on them unchanged. The rate is
per month, not per contract.

Step 6 is complete.

**7 — Profile card rebuild. Done.** Themed by niche, photos, every field
editable before sending, AI gap-fill for unsold formats, and the public page
retired (031). The Instagram integration is built and inert (033): setting
`EXPO_PUBLIC_META_APP_ID` plus the function secrets is the whole activation,
and CPV starts populating from the first nightly sync. YouTube is still
mocked.

**8 — Offline capture.** Last, because it touches every write path and is
easier once those paths have stopped changing.

**9 — Marketing website.**

---

## 12. Open items

- Apple Developer account — needed before iOS push can be tested.
- Meta Graph API and YouTube Data API credentials — needed to replace the
  mocked providers, and to make the profile card refresh itself.
- Final pricing.
