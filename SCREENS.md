# CreatorDesk — screen and content specification

A brief for design. This says **what each screen is for and what it contains**.
It deliberately says nothing about layout, colour, type, spacing, shadow or
motion — those are the design decisions this document exists to hand over.

---

## The product in one paragraph

CreatorDesk is the business side of being an Indian content creator. A creator
lands a brand deal, delivers the content, and then chases the money for two to
three months. The app tracks the deal from first message to payment received:
what was agreed, what is due when, what has been delivered, what has been
invoiced, and what is still owed. Two promises drive everything: **she never
misses a deadline**, and **she never loses track of money owed**.

The user is one person, on a phone, usually mid-conversation with a brand. The
app also runs on desktop web, where she does the heavier work — invoicing,
reviewing the year.

**Amounts are always Indian rupees**, written with Indian digit grouping
(₹1,00,000 not ₹100,000) and abbreviated as K / L / Cr, never M / B.

---

## Vocabulary used throughout

These are the exact words the product uses. They should appear as-is.

**Deal status** — New · Script · Shoot · Edit · Live · Unpaid · Paid

**Payment status** — Pending · Nudged · Overdue · Paid

**Platform** — Reel · Post · Story · Short · YouTube · X · LinkedIn · Other

**Deliverable type** — Reel · Story · Carousel · Post · Short · YouTube
integration · Live · Ad rights · Auto-DM · Other

**Reminder stage** — Script · Shoot · Edit · Publish · Add link

Other recurring terms: *brand* (the client), *deliverable* (one item sold),
*ad rights* (a paid licence for the brand to run the content as an ad),
*rate* (what the creator charges), *TDS* (tax the brand withholds),
*GSTIN* (tax registration number), *live link* (URL of the published post).

---

## Global elements

**Navigation — five destinations, no more.** Home · Work · Money · Brands · You.
Bottom bar on phone, side rail on desktop. Home carries a badge showing how many
things need attention today.

**Header utilities**, present on every main screen: search, notifications bell
(with unread count), day/night toggle, and a primary "new deal" action.

**Search** covers three things by name: a deal, a brand, or an invoice number.
Results are one ranked list, not sectioned.

**Two themes**, day and night, both first class, switchable and remembered.

**Toasts** for confirmations and errors. **Confirmation prompts** for anything
destructive.

---

## 1. Sign in

**Purpose:** return a known creator to her work.

Contains:
- Product name and one line of positioning
- Email field
- Password field
- Sign in action
- Link to forgot password
- Link to create an account

States: idle · submitting · wrong credentials · network failure.

---

## 2. Sign up

**Purpose:** create an account in as few fields as possible. Everything else is
asked later, and optionally.

Contains:
- Product name and one line saying what the app does
- Name field
- Email field
- Password field
- Create account action
- Link back to sign in
- **A second state:** after submitting, a "check your inbox" confirmation
  telling her to verify the email address, with a way back to sign in

Only three fields. Niche, phone, payment details and tax details are **not**
asked here.

States: idle · submitting · email already registered · weak password · sent.

---

## 3. Forgot password

**Purpose:** send a reset link.

Contains:
- Email field
- Send reset link action
- Link back to sign in
- **A second state:** "check your inbox" confirmation

Note: the confirmation shows whether or not the address exists, deliberately.

---

## 4. Reset password

**Purpose:** set a new password after following the emailed link.

Contains:
- New password field
- Confirm password field
- Update password action

On success she is returned to sign in rather than dropped into the app.

---

## 5. Onboarding — offered once, entirely skippable

**Purpose:** collect the details that make invoices and reminders work. Offered
after the first sign-in. Declining costs one tap and it never returns.

**Step one — who she is**
- Niche (e.g. fashion, tech, food, finance)
- Follower count, roughly
- Phone number

**Step two — how she gets paid**
- UPI ID
- Bank account number
- IFSC code
- GSTIN, only if she is registered

Contains a two-step progress indicator, Back / Next / Finish, and a Skip that is
available at every point. **No field is mandatory.**

---

## 6. Home — "what needs me today"

**Purpose:** the first screen after sign-in. Answers two questions before any
scrolling: what am I owed, and what needs me today.

Contains:
- Today's date and a greeting using her first name
- **Money owed** — the single largest figure on the screen, with: how many
  unpaid deals it spans, how much is on track, how much is overdue, and a link
  through to Money
- **A six-month trend** of payments actually received
- **Three supporting figures** — received this month (and how many payments),
  locked this month (value of deals signed, and how many), live deals in
  progress
- **Needs you** — up to four items requiring action today, each showing brand,
  what was sold, the amount, the deal's status, and *why it is listed*
  ("Shoot was due 7 Aug", "Publish was due 6 days ago", "Add the live link to
  start the payment clock")
- **Four quick actions** — new deal, raise invoice, add brand, year in review
- **All deals** — a filterable list. Filters: All · Needs you · New · Script ·
  Shoot · Edit · Live · Unpaid · Paid. Each row shows brand, platform, what was
  sold, next deadline, amount, and status
- Occasionally, **a rate nudge**: a single dismissible line saying her audience
  has grown but her rate has not

States: loading · empty (no deals yet) · nothing needs attention · populated.

---

## 7. Work — "what have I made"

**Purpose:** the back catalogue and how it performed. Two views behind a
switch.

**Archive** — everything shipped, grouped by year. Summary figures: lifetime
earned, brands worked with, years active. Each entry shows brand, platform,
what was sold, when it went live, and what it paid.

**Performance** — how the content did. Summary figures: total views, best
performing post. Per item: platform, brand, views, likes, comments, saves,
shares, reach, and engagement rate. Numbers are entered by hand today, so the
screen must be honest that they are manual.

States: loading · no work yet · no performance numbers entered yet.

---

## 8. Money

**Purpose:** the financial picture, and the way into invoices.

Contains:
- **Locked this month** — value of deals signed, as the headline figure
- Landed this month, average deal size, deals closed
- Best paying brand
- A six-month chart of payments received
- Split of what is paid, pending and overdue
- **Invoices** — a way through to the invoice list
- **Year in review** — income, TDS and GST for the financial year

States: loading · no money yet · populated.

---

## 9. Brands

**Purpose:** who she has worked with and how they behaved.

Contains:
- Summary: brands on file, how many rated, average score
- Search across brands
- A list. Each brand shows: name, contact person, how many deals, total earned
  from them, and a reputation score if rated
- An action to add a brand

States: loading · empty · searching with no results.

---

## 10. Brand detail

**Purpose:** everything about one client.

Contains:
- Brand name, contact person, email, phone
- Tax details: GSTIN, billing address, state
- What they are worth: total earned, number of deals, average deal size,
  whether they pay on time
- Reputation score, if rated
- Every deal with this brand
- Actions: edit, add a deal with them

---

## 11. Add brand

**Purpose:** save a client, ideally in under a minute.

Contains: name, contact person, email, phone, GSTIN, billing address, state,
notes. **Nothing is mandatory.**

---

## 12. New deal

**Purpose:** capture a deal while she is still in the conversation. Three ways
in, one review step.

**Three intake modes:**
1. **Screenshot** — she uploads the brand's message and the app extracts the
   details
2. **Voice** — she describes the deal out loud and the app extracts the details
3. **Type** — she fills it in herself

Extraction fills the form; **every field stays editable and nothing saves on its
own**. The input is usually Hindi-English code-mixed with shorthand ("15k",
"1.5L", "agle hafte").

The form contains: brand (pick existing or create new), platform, what is being
delivered, rate, the four dates (script, shoot, edit, publish), payment terms,
notes. Optionally an itemised breakdown of deliverables, and ad rights terms
(fee, duration, start date).

States: idle · extracting · extraction failed · saving.

---

## 13. Deal detail

**Purpose:** one deal, end to end. The screen she opens most.

Group the content into three subjects:

**The work**
- Current status, and a way to advance it to the next stage
- The four-stage timeline — script, shoot, edit, publish — showing which stage
  is next, which are done, which were skipped, and the date of each. Dates are
  editable here.
- Platform
- Deliverables: each item, quantity, and what it is worth. Ad rights show their
  duration, window, and the per-month value.
- Live link — the URL of the published post

**The money**
- Rate
- Payment terms and the resulting due date
- Payment status
- A way to send a WhatsApp payment reminder to the brand, with the message
  escalating in tone based on how many have already gone out
- The invoice: create one, or view the existing one

**The paperwork**
- Attachments — contracts and briefs, with upload and delete
- Notes
- Performance numbers, entered by hand
- A post-deal rating of the brand, prompted once the deal is paid
- History of messages already sent to this brand

Also: a workflow reminder card when one is live, offering Done · +12 hours ·
Tomorrow.

States: loading · saving · deal not found.

---

## 14. Reminders

**Purpose:** everything asking for a response, split by time.

**Today** — scheduled reminders whose moment has arrived, plus alerts derived
from deal state (a payment eight days late, a published post with no link).
Scheduled reminders offer Done · +12 hours · Tomorrow. Derived alerts have
nothing to snooze; they open the deal instead.

**Upcoming** — what is coming and when.

Each item shows: brand, what it concerns, and when.

States: loading · all clear · populated.

---

## 15. Invoices

**Purpose:** every invoice raised, and what they add up to.

Contains: totals for the current financial year, and a list showing invoice
number, brand, date, amount, whether GST applies, and status.

On desktop this is a table with aligned figures. On phone it is rows.

---

## 16. New invoice

**Purpose:** turn delivered work into a document, deriving everything possible.

Contains:
- Bill to: brand name, contact person, email
- **Consolidation**: other delivered-but-unbilled deals for the same brand,
  offered so one invoice can cover several
- Line items: description, quantity, rate, amount
- Charge GST toggle. When on, also: the brand's GSTIN, their billing address,
  and place of supply
- TDS withheld toggle and amount
- Payment due date
- Notes
- **A live preview** of the figures exactly as they will print, including the
  total written out in words

**Nothing is mandatory.**

---

## 17. Invoice detail

**Purpose:** view one invoice and get it to the brand.

Contains the document itself — creator's details, bill-to, line items, tax
breakdown, total due, amount in words, payment details — plus an action to
print or save it as a PDF, and one to mark it paid.

### The printed invoice (a separate design job)

This is the most formal thing the product produces. It goes to a brand's
finance team and is the creator's evidence in a payment dispute. It is a
single A4 page and must carry, by law:

- The creator's name, address and GSTIN
- Invoice number and date
- The brand's name, address and GSTIN
- Place of supply
- Each line: description, SAC code, quantity, rate, amount
- Tax split by head — CGST + SGST, or IGST — each with its rate
- Total, TDS withheld, and amount due
- The amount in words
- Whether reverse charge applies
- Payment details: UPI, bank account, IFSC

---

## 18. Year in review

**Purpose:** the financial year summarised for tax time.

Contains: total income, deals completed, brands worked with, average deal size,
TDS withheld, GST collected, month-by-month breakdown, and top brands by value.

---

## 19. You / Settings

**Purpose:** her own details, and the app's preferences.

Contains:
- Profile: name, email, phone, niche, follower count — with a way to edit
- **Billing details**: PAN, GSTIN, address, UPI, bank account, IFSC — the
  details that appear on invoices
- **Connected accounts**: Instagram and YouTube, to pull real reach figures.
  Read-only, nothing is ever posted, and the copy must say so
- **Reminders**: whether notifications are permitted, how many are currently
  scheduled, and a way to fire a test one
- **Appearance**: day / night / follow the system
- **Public profile card**: a toggle, and the shareable link when on
- Sign out

---

## 20. Public creator profile

**Purpose:** the only screen a brand ever sees. Opened from a link during a
negotiation, by someone with no account.

Contains: creator name, niche, follower count, platforms, deals completed, and
selected work. **Never** rates, client names, contact details or notes.

It carries more visual weight than anything inside the app, because it is doing
a job of persuasion.

---

## Recurring pieces

These appear on many screens and should be designed once:

| Piece | What it shows |
|---|---|
| Deal row | Brand mark, brand name, platform, what was sold, next deadline or a reason, amount, status |
| Brand row | Brand mark, name, contact, deal count, total earned, score |
| Stat tile | A label, a figure, a caption, sometimes a trend |
| Status pill | Deal or payment status — colour is never the only signal, the label always appears |
| Stage timeline | Four stages with their state and date |
| Bar chart | Monthly comparison, with a scale |
| Sparkline | An inline trend |
| Progress ring | One value against a whole |
| Empty state | An icon, a line of explanation, and the action that resolves it |
| Loading state | A placeholder shaped like the content it is replacing |
| Sheet | A modal surface for pickers and prompts |
| Date picker | A calendar, plus shortcuts for today / tomorrow / next week |

---

## States every screen needs

1. **Loading** — first fetch
2. **Empty** — a real creator on day one, with no deals, no brands, no money
3. **Populated** — the normal case, roughly 50 deals across 10 brands
4. **Error** — the fetch failed
5. **Both themes** for all of the above

The empty state matters more than it looks: it is the first thing a new
creator sees, and it is where she decides whether the app is worth filling in.
