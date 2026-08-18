-- 036: Razorpay billing, and CreatorDesk's own GST invoices.
--
-- Everything that does not need the keys. Setting RAZORPAY_KEY_ID and
-- RAZORPAY_KEY_SECRET as function secrets is the switch, exactly as with Meta
-- in 033 — no code changes on the day they arrive.
--
-- ── Why Razorpay Subscriptions and not one-off orders ───────────────────────
--
-- §3 sells terms of 1, 3, 6, 9 and 12 months, and a creator should not have to
-- remember to pay again. Razorpay's Subscriptions API carries the recurring
-- mandate (UPI Autopay, card e-mandate, netbanking), which is the whole reason
-- §3 chose Razorpay over Stripe for India.
--
-- It also means the RBI rule bites where §3 says it does: a change in the debit
-- amount needs the customer to re-authorise. A monthly subscriber whose price
-- goes ₹999 → ₹1,999 when the launch offer closes gets a NEW subscription to
-- approve, not a silently larger charge on the old mandate.
--
-- ── What is never trusted from the client ───────────────────────────────────
--
-- The price. `razorpay-checkout` computes it with term_price_paise() from 035
-- and ignores anything the app sends. A client that could name its own amount
-- would be a client that could buy a year for ₹1.
--
-- Safe to re-run.


-- ── 1. Razorpay plan ids ────────────────────────────────────────────────────
-- Razorpay wants a Plan object per (amount, interval) before a Subscription can
-- reference it. Created lazily by the edge function the first time a term is
-- bought at a given price, and cached here — a plan is immutable at their end,
-- so a price change means a new plan rather than an edit.
--
-- Keyed on amount as well as term: when the launch offer closes, ₹999/monthly
-- and ₹1,999/monthly are two different Razorpay plans and both must survive,
-- because subscribers on the old one keep renewing against it.

create table if not exists razorpay_plans (
  id                uuid        primary key default gen_random_uuid(),
  term_key          text        not null references billing_terms(key),
  amount_paise      integer     not null,
  razorpay_plan_id  text        not null unique,
  created_at        timestamptz not null default now(),
  unique (term_key, amount_paise)
);

alter table razorpay_plans enable row level security;
-- No policy at all: only the service role touches this. A plan id is not
-- secret, but nothing in the app has any reason to read one. The grants are
-- revoked too rather than relying on RLS alone — two independent reasons the
-- client cannot reach it.
revoke all on razorpay_plans from anon, authenticated;


-- ── 2. What was actually charged ────────────────────────────────────────────
-- The record of money received, written by the webhook. Separate from
-- `subscriptions` because that table holds the current state while this is the
-- history, and a refund or a failed retry has to be visible without rewriting
-- what the subscription currently is.

create table if not exists subscription_payments (
  id                      uuid        primary key default gen_random_uuid(),
  /**
   * Nullable, and detached rather than deleted when a workspace goes.
   *
   * A financial record has to outlive the customer: GST invoices are retained
   * for six years whether or not she is still a subscriber. `cascade` would
   * destroy our own revenue records the first time someone deleted an account,
   * and `restrict` would make deletion fail outright — breaking the DPDP
   * erasure path in 028. Detaching keeps both obligations.
   */
  workspace_id            uuid        references workspaces(id) on delete set null,

  razorpay_payment_id     text        unique,
  razorpay_subscription_id text,

  /** Ex-GST, in paise. See the unit note in 035. */
  amount_paise            integer     not null,
  gst_paise               integer     not null default 0,
  total_paise             integer     not null,

  term_key                text        references billing_terms(key),
  status                  text        not null default 'captured'
                            check (status in ('captured', 'failed', 'refunded')),

  period_start            timestamptz,
  period_end              timestamptz,
  paid_at                 timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

create index if not exists subscription_payments_workspace_idx
  on subscription_payments (workspace_id, paid_at desc);

alter table subscription_payments enable row level security;

-- Readable by the workspace, because §3 promises a GST invoice and a creator
-- has to be able to find what she paid. Never writable from the client: this is
-- a financial record, and the only thing that may write it is the webhook.
drop policy if exists "subscription_payments: workspace reads" on subscription_payments;
create policy "subscription_payments: workspace reads"
  on subscription_payments for select to authenticated
  using (workspace_id in (select auth_workspace_ids_allowing('money')));

-- From anon as well as authenticated. Supabase grants to both by default, so
-- revoking from one leaves the other holding the same rights — which is exactly
-- what the verification below caught on the first run of this migration.
revoke insert, update, delete on subscription_payments from anon, authenticated;


-- ── 3. Our own GST invoices ─────────────────────────────────────────────────
-- §3: "CreatorDesk sells a SaaS subscription to Indian customers and therefore
-- owes GST on it, and must issue a GST invoice to each subscriber, carrying
-- their GSTIN where they have one."
--
-- A separate series from the invoices creators raise to brands. Same tax logic,
-- opposite direction — here we are the supplier — and mixing the two numbering
-- series would corrupt both returns.
--
-- Place of supply drives the CGST+SGST versus IGST split, and for a service
-- supplied to an unregistered customer it is her state. Stored per invoice
-- rather than derived later, because our own registered state can change and a
-- past invoice must not silently re-split itself.

create table if not exists subscription_invoices (
  id                 uuid        primary key default gen_random_uuid(),
  workspace_id       uuid        references workspaces(id) on delete set null,
  payment_id         uuid        references subscription_payments(id) on delete set null,

  /** Our series, e.g. CD/2026-27/00042. Gapless within a financial year. */
  invoice_number     text        not null unique,
  financial_year     text        not null,
  invoice_date       date        not null default current_date,

  /** Snapshotted: her details at the time of supply, not as later edited. */
  customer_name      text        not null,
  customer_gstin     text,
  customer_state_code text,

  taxable_paise      integer     not null,
  cgst_paise         integer     not null default 0,
  sgst_paise         integer     not null default 0,
  igst_paise         integer     not null default 0,
  total_paise        integer     not null,

  created_at         timestamptz not null default now()
);

create index if not exists subscription_invoices_workspace_idx
  on subscription_invoices (workspace_id, invoice_date desc);

alter table subscription_invoices enable row level security;

drop policy if exists "subscription_invoices: workspace reads" on subscription_invoices;
create policy "subscription_invoices: workspace reads"
  on subscription_invoices for select to authenticated
  using (workspace_id in (select auth_workspace_ids_allowing('money')));

revoke insert, update, delete on subscription_invoices from anon, authenticated;

-- The customer's name and GSTIN are snapshotted above precisely so the invoice
-- still means something once the workspace is gone. Rule 46 invoices are
-- retained for six years regardless of whether the customer is still a
-- customer — a legal obligation that survives a DPDP erasure request for this
-- narrow class of record, which is exactly why the erasure path detaches these
-- rather than being blocked by them.


-- ── 4. The invoice number ───────────────────────────────────────────────────
-- Gapless per financial year, and allocated inside the transaction that writes
-- the invoice, so a failed webhook retry cannot burn a number. Advisory lock
-- rather than a sequence: sequences are not gapless on rollback, and a GST
-- series with holes is a series that has to be explained to an officer.

create or replace function next_subscription_invoice_number(fy text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  perform pg_advisory_xact_lock(hashtext('subscription_invoice_number:' || fy));

  select count(*) into used from subscription_invoices where financial_year = fy;
  return 'CD/' || fy || '/' || lpad((used + 1)::text, 5, '0');
end $$;

revoke all on function next_subscription_invoice_number(text) from public;


-- ── 5. Verification ─────────────────────────────────────────────────────────

do $$
declare
  leaked text;
begin
  if to_regclass('public.subscription_payments') is null
     or to_regclass('public.subscription_invoices') is null
     or to_regclass('public.razorpay_plans') is null then
    raise exception 'Billing tables were not all created';
  end if;

  -- Financial records must never be writable from a client session. A creator
  -- who could edit what she was charged, or issue herself an invoice, is a
  -- creator who can corrupt our GST return.
  --
  -- table_privileges, not column_privileges: DELETE is a table-level privilege
  -- and does not appear in the column view at all, so the obvious check would
  -- have verified two of the three and reported success.
  select string_agg(distinct grantee || ' on ' || table_name, ', ') into leaked
    from information_schema.table_privileges
   where table_schema = 'public'
     and table_name in ('subscription_payments', 'subscription_invoices', 'razorpay_plans')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
     and grantee in ('authenticated', 'anon', 'PUBLIC');

  if leaked is not null then
    raise exception 'Billing records are writable from a client session: %', leaked;
  end if;

  -- Our tax records must survive a workspace being deleted, and must not block
  -- the deletion either. 'n' is SET NULL; 'c' would destroy them and 'r' would
  -- make 028's erasure path fail for anyone who ever paid.
  if exists (
    select 1 from pg_constraint
     where conrelid in ('subscription_invoices'::regclass, 'subscription_payments'::regclass)
       and confrelid = 'workspaces'::regclass
       and contype = 'f'
       and confdeltype <> 'n'
  ) then
    raise exception 'Billing records must SET NULL on workspace delete — not cascade, not restrict';
  end if;

  raise notice 'OK. Billing records exist, and nothing but the server can write them.';
end $$;
