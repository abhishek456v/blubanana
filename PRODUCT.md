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
| `deals` | **Remove** the four fixed date columns (`script_due_date`, `shoot_date`, `edit_done_date`, `publish_date`) | 021 | Stages are user-defined — §8.5. Held until reminders stop reading them (step 3) |
| `payments` | **Add** `amount_received`, `tds_amount`, `label`, `sort_order` | 019 | Invoiced ≠ received — §8.7 |
| `payments` | **Drop the `unique` on `deal_id`** | 021 | A deal can have several payments. Held back because it flips PostgREST's embed from object to array — §11 |
| `brands` | **Remove** `contact_person`, `contact_phone`, `contact_email` | 021 | Superseded by `brand_contacts` |
| `memberships` | **Add** per-area permission flags | Step 5 | §7 |

`deals.rate` keeps its meaning throughout: always the INR figure, so every
existing query, report and total is unaffected by the currency work.

### New tables

| Table | Holds |
|---|---|
| `deal_stages` | name, order, due date, done, done_at — one row per stage per deal (**019**) |
| `brand_contacts` | many POCs per brand: name, phone, email, role, is_primary (**019**) |
| `push_tokens` | Expo push tokens per user per device |
| `subscriptions` | plan, period, Razorpay ids, status, trial dates |
| `expenses` | date, category, amount, note, receipt attachment |
| `brand_aggregates` | anonymous cross-tenant reputation — **no creator identifiers** |

`brand_aggregates` carrying no creator identifier is not an implementation
detail. It is what makes the table safe to read across tenants at all.

---

## 7. Roles and permissions

**Change** — the schema supports membership; there is no invite UI.

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

---

## 8. How it works

### 8.1 Signing up — **New**

Sign up on the website or in the app → 14-day trial starts immediately → she
lands in an empty workspace. No card required to start.

### 8.2 Onboarding, and importing what she already has — **New**

A creator arriving has live deals already. If day one is "type in all eight",
she leaves.

So onboarding offers to **import**: point the existing screenshot intake at a
spreadsheet, a screenshot of her notes, or an exported CSV, and pull the deals
in. The extraction already exists (§8.3); this is wiring it to a different
starting point.

Everything in onboarding is skippable. Nothing is mandatory.

### 8.3 Getting a deal in — **Built** (plus one new mode)

Four ways to start, all landing on the same form:

| Mode | How | Status |
|---|---|---|
| **Screenshot** | Photograph or upload a brand DM/email. GPT-4o vision extracts the fields | **Built** |
| **Voice** | Talk it through. Whisper transcribes, then the same extractor reads it | **Built** |
| **Type** | Fill the form directly | **Built** |
| **Repeat** | Copy the terms of a previous deal | **New** — §8.4 |

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

### 8.4 Repeating a deal — **New**

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

### 8.5 Stages and deadlines — **Change**

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

### 8.6 When a deal stalls — **New**

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

**Advances and part-payments** — **New.** Today the schema allows exactly one
payment per deal. But *50% advance, 50% on delivery* is the most common
arrangement in Indian creator work. A deal can now carry several payments, each
with its own amount, due date and status.

**Marking a payment received** — **New.** This is where the numbers get lied
to, so it gets a deliberate, attention-taking dialog rather than a quiet
toggle. It asks what **actually landed**, which is often not what was invoiced:

> Invoiced ₹1,00,000
> **Received** ₹90,000
> **TDS withheld** ₹10,000

Without this, either the deal looks underpaid forever, or she records ₹90,000
and her income reports understate gross by exactly the TDS figure she needs at
tax time.

**Foreign currency** — **New.** A deal can be denominated in another currency.
The original amount is stored **and** an INR value snapshotted at the time of
entry. Tax reporting must be in INR, and last year's dollar deal cannot be
revalued at today's rate.

**Chasing** — **Built.** Payments escalate Pending → Nudged → Overdue. At each
level the app drafts a message appropriate to that level and hands it to
WhatsApp as a pre-filled `wa.me` link addressed to the brand's contact. She
reads it and sends it herself. Nothing is ever sent automatically.

**Collection rate** — **New.** Of everything invoiced this year, what
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

**UPI QR code** — **New.** The invoice carries a QR generated from the
creator's UPI ID. The brand scans it and pays her directly, bank to bank.
Money never touches the platform, so this needs no licensing and costs nothing.

**Sending** — **New.** One tap sends the invoice to the brand's contact over
WhatsApp, using the channel already built for payment nudges. Today it is
export-to-PDF, then find the chat, then attach.

**The template is a design job in its own right.** A single A4 page, and it is
the only thing a brand's finance team ever sees from this product. It must look
considered — not a generic template, and emphatically not a default.

### 8.9 Reminders and notifications — **Change**

Today reminders are scheduled **on the device**. That is why they die when the
app is not opened, and why they never work on the web.

**They become real push notifications**, which requires:

- A `push_tokens` table, populated on sign-in per device.
- A scheduled server job (Supabase `pg_cron` + an edge function) that wakes
  periodically, finds due reminders, and sends via the Expo Push API.
- The scheduling logic moves off the phone and onto the server.

Note two practical constraints: iOS push needs an **Apple Developer account**,
and push **cannot be tested in Expo Go** — it needs a development build.

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

### 8.11 The profile card — **Change**

This is **not** a public web page. The current implementation gets this wrong
and will be rebuilt.

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

She can share it straight to WhatsApp or download it.

### 8.12 Expenses — **New**

Optional, and simple: date, category, amount, note, and a receipt image.
Editor salaries, cameraman fees, script writers, equipment, travel.

Free-text entry can be parsed by the same AI extraction used elsewhere.

Expenses feed the annual report, which is what turns "turnover" into "taxable
income".

### 8.13 Tax — **New**

**Deadline reminders.** Indian freelancers pay **advance tax quarterly** —
15 June, 15 September, 15 December, 15 March — and missing it means interest
under sections 234B and 234C. Most creators find out from their CA in March.
Registered creators also file **GSTR-1** (11th) and **GSTR-3B** (20th) monthly.

The notification says only: *"Advance tax due 15 September."* No amounts —
see the privacy rule in §8.9. It also cannot state a figure honestly, because
the app only knows the income that passed through it; she may have income it
never saw.

**Tax calculator.** In-app, and she drives it. It offers her own data — income
and expenses over a period she chooses — as a starting point, she adjusts and
adds anything the app does not know about, and it computes what she should set
aside. A calculator she feeds is honest. A notification that guesses is not.

**Annual report** — **Built**, made **editable**. The Indian financial year,
April to March, with income, TDS and GST. It reports **gross and net**, so
"tax-ready" means taxable income rather than turnover. Creators need to adjust
figures their app never saw, so the report is editable before export.

### 8.14 Ad rights — **Built**

A toggle on the deal. Off by default; when on it captures the fee, the
duration, and the start date — and derives the expiry from those rather than
asking for it twice. A reminder fires before it expires, and a link opens the
Meta Ad Library so she can check whether the brand is still running the ad.

### 8.15 Retainers — **New**

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

### 8.17 Content performance — **Change**

Views, likes, comments and saves per deliverable. Entered manually today.

**The Instagram and YouTube integrations are currently mocked** — a
`MockSocialProvider` behind a clean interface, so switching to real Meta Graph
API and YouTube Data API changes one map and no screens. Real credentials go in
at deployment.

Until then, be honest in the UI that these figures are manual.

### 8.18 Export and deletion — **New**

**Export.** Everything she has — deals, brands, payments, invoices, expenses,
ratings — as CSV and JSON. Available at any time, including during the
read-only state after a lapsed trial or subscription.

**Delete my account.** A real deletion path, not a cancellation. This is a
legal obligation, not a courtesy: CreatorDesk stores brand contacts' names and
phone numbers, which is **third-party personal data**, making the business a
Data Fiduciary under India's **Digital Personal Data Protection Act 2023**.
The marketing site needs a privacy policy for the same reason.

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
| Tax calculator | Advance tax and GST | **New** |
| Expenses | Log and categorise | **New** |
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

**2 — The screens those break.** Deal detail's timeline, new deal, payment
marking, Money's totals (respecting on-hold), Brands' contacts.

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

**3 — Push notifications, and rekeying reminders.** `push_tokens`, the
`pg_cron` job, the send function, moving reminder scheduling server-side.

It also has to rekey reminders to `deal_stages.id`. Today they are keyed to a
fixed `ReminderStage` enum (`script_due | shoot | editing | publish`) that
user-defined stage names cannot satisfy. Until that lands, deal detail and new
deal keep writing the four legacy date columns from the first four stages by
position, purely to keep reminders firing. That bridge is lossy and known to
be: a deal with six stages gets reminders for four of them. `021` drops the
columns once this step removes the last reader.

**4 — Subscriptions.** `subscriptions`, Razorpay integration, the trial gate,
read-only state, our own GST invoicing.

**5 — Roles.** Membership permission flags, the invite UI, RLS enforcement of
the delete rule.

**6 — The additions.** Repeat a deal, retainers, expenses, tax calculator,
collection rate, invoice-over-WhatsApp, UPI QR, export, delete account.

**7 — Profile card rebuild**, then real Meta/YouTube APIs when credentials land.

**8 — Offline capture.** Last, because it touches every write path and is
easier once those paths have stopped changing.

**9 — Marketing website.**

---

## 12. Open items

- Apple Developer account — needed before iOS push can be tested.
- Meta Graph API and YouTube Data API credentials — needed to replace the
  mocked providers, and to make the profile card refresh itself.
- Final pricing.
