# Blubanana

## Saving work

Save progress after every piece of work, without being asked:

1. Commit every change on `main`.
2. Update this file with anything a future session needs to know, in the same commit.
3. Push with `git push origin main`, run as its own command.

The owner wants work pushed straight to `main`, with no branches or pull requests. Every push to `main` redeploys both live sites on Vercel.

Pushing is allowed by the rule `Bash(git push origin main)` in the owner's user settings. Other spellings, such as `git push` alone or a push chained after another command with `&&`, may still be blocked.

## Server functions

A push does not update the Supabase server functions in `supabase/functions/`. Each one has to be deployed on its own, and a function left behind keeps running old code while the repo looks finished. On 26 Oct 2026 `extract-deal` was still the July version and `send-due-reminders` was older than its last change.

The Supabase CLI is not installed, so deploy with npx (`--use-api` needs no Docker):

```
cd ~/Projects/crm-app && SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -w) npx -y supabase@2 functions deploy <name> --project-ref bbdvgeavtxfxykhiafbp --use-api
```

The auto-mode safety check blocks Claude from running this, so the owner runs it in Terminal. `verify_jwt` for each function comes from `supabase/config.toml`.

After any change under `supabase/functions/`, compare the function's last commit time with its live `updated_at` from `GET https://api.supabase.com/v1/projects/bbdvgeavtxfxykhiafbp/functions` (same keychain token).

## Money rules the code relies on

These were settled during the November 2026 QA pass. Break one and figures on different screens stop agreeing.

- **A deal is worth `dealValue(deal)`**, which is `rate` plus the ad-rights fee. `deals.rate` is the content only. Lists, the deal header and the payment schedule all use `dealValue`. "To be paid" uses `outstandingOn(deal)`. A reminder or attention row shows the amount of the instalment being chased, not the deal.
- **Ad rights are a line item.** They are entered as a `deal_deliverables` row with `kind = 'ad_rights'` and mirrored onto the `deals.ad_rights_*` columns. Anything that writes one must write the other.
- **The payment schedule adds up to the deal value**, and the functions in `platform/lib/deals.ts` keep it that way: adding an instalment carves it out of the latest unpaid row big enough, editing one moves the difference onto the last other unpaid row, removing one hands the amount back. They only do this when the schedule added up beforehand, and they never rewrite a paid row. Deals older than this rule can show a "not scheduled yet" line in `InstalmentsCard`; that is the honest state, not a fault.
- **A part payment leaves the deal open.** `settlePayment` returns the fields it wrote so the screen can update in place. The deal only becomes `paid` when the last instalment is settled.
- **A deal is invoiced by either of two routes**: `invoices.deal_id` (set only when every deal line belongs to one deal) or `invoice_line_items.deal_id`. Ask through `getInvoiceForDeal` or `getInvoicedDealIds` in `platform/lib/invoices.ts`, never by reading `invoices.deal_id` alone.
- **Tax figures use the gross**, `grossOf(payment)`, which adds back the TDS the brand held. Bank-side figures use the net received.
- **Dates:** turn a `Date` into a stored day with `toDateString(date)` and read one back with `parseLocalDate`, both in `platform/lib/format.ts`. `toISOString().split('T')[0]` is a day early before 5:30 in the morning in India. `formatDate` adds the year whenever the date is not in the current one.
- **`Figure` counts bare numbers up in their own decimal places.** Pass `format` only when the number needs dressing (currency, a suffix); never pass `String`.

## Workspaces, managers and whose details print

A person can belong to several workspaces (their own, plus any they manage). The database works in exactly one at a time.

- **`auth_active_workspace_id()`** (migration 052) is the chosen workspace (`profiles.active_workspace_id`) if an active membership still backs it, else the one they own, else the oldest. All four `auth_*workspace_ids*` helpers are narrowed to it, so every policy and masking view follows. Do not add a policy that reads `memberships` directly.
- **`getWorkspaceId()`** asks the database for it. Never take "the earliest membership" in the client. `switchWorkspace()` stores the choice and bumps a version; the signed-in layout is keyed on it, so screens remount and re-read. `useWorkspace()` gives `choices`, `isOwner`, `switchTo`.
- **`claim_pending_invites()`** moves a newly invited person into the workspace they were invited to only if their own is empty. The layout waits for it (4 s cap) before rendering.
- **Owners' things stay with owners.** A manager does not see Team, Plan and billing, Billing details or the Rate card, and the trial banner is replaced by a read-only note when the creator's plan lapses. The rate card is the creator's own media kit (their photos, theme, name).
- **Never print `getProfile()` on an invoice.** That is the viewer's own row. Use `getWorkspaceProfile()` (RPC `workspace_owner_profile`, migration 053): the workspace owner's details, with phone/address/GSTIN/PAN released to Invoices or Bank-and-billing members and UPI/account/IFSC to Bank-and-billing members only. `payment_hidden` / `invoicing_hidden` say what was withheld.
- **Pushes follow permissions.** `send-due-reminders` sends a reminder only to devices whose owner is an active member of that workspace and may see its area: workflow, ad-rights and survey reminders need `can_see_deals`, payment and tax need `can_see_money`, owners always. A removed manager's phone stops hearing at once. Needs a deploy to take effect (see Server functions).
- **Format checks live in `lib/validate.ts`** (GSTIN with checksum, PAN, IFSC, account, UPI, phone, email). Profile, onboarding, brand contacts and the invoice form use them. `profiles.pan` exists (053, constraint added `not valid` so old rows are untouched). The seed computes valid GSTIN check characters.

## Database changes

`supabase db push` is blocked, so migrations are applied through the Management API with the keychain token (`POST https://api.supabase.com/v1/projects/bbdvgeavtxfxykhiafbp/database/query`). A migration file in the repo is therefore not proof it ran: read the result back. `050` and `051` were applied on 15 Nov 2026, and `052` and `053` the same day.

## The demo account

`demo@blubanana.in` is filled by `platform/scripts/seed-demo.mjs`, which takes its password from `DEMO_PASSWORD` and has no default. An earlier password sat in this public repo and is still in its history, so it must be treated as known. `platform/scripts/rotate-demo-password.mjs` sets a new one; the owner runs it in Terminal.

## Testing in a browser

- Start the web app with `npx expo start --web --port 8082 < /dev/null`. With `CI=1` in front, Expo stops watching files and keeps serving the old bundle after every edit. Port 8081 belongs to another project.
- On a wide screen the page underneath a sheet stays mounted, so the same text exists twice. In Playwright, narrow with `.locator('visible=true')` or the click lands on the hidden copy and times out.
- Throwaway accounts are deleted, with their workspace, in the same session, and checked gone.
