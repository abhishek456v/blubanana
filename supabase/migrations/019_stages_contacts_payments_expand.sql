-- ═════════════════════════════════════════════════════════════════════════════
-- 019: custom stages, multiple brand contacts, richer payments, deal flags
--
-- This is the EXPAND half of an expand/contract pair, following the same
-- pattern as 009 → 010 → 011.
--
-- Everything here is ADDITIVE. Nothing is dropped, nothing changes shape, and
-- the app running against the database right now keeps working unchanged after
-- this runs. That is deliberate: the old columns stay until the code that reads
-- them has moved, and 020 does the dropping.
--
-- One removal in particular is NOT here, and the reason matters.
--
--   payments.deal_id carries a UNIQUE constraint, which is the only reason
--   PostgREST returns `payment:payments(...)` as an OBJECT rather than an
--   ARRAY. Every screen reads `deal.payment?.due_date`. Drop that constraint
--   and PostgREST silently starts returning `payment: [...]`, every one of
--   those reads becomes undefined, and the app shows blank payment data with
--   no error anywhere. So the constraint comes off in 020, in the same change
--   as the code that stops expecting an object.
--
-- Run this by pasting it into the Supabase dashboard SQL editor. It runs as one
-- transaction: the verification block at the end raises on any inconsistency,
-- which rolls the whole thing back rather than leaving a half-migrated schema.
--
-- Re-running is safe. Every statement is guarded and every backfill skips rows
-- it has already written.
-- ═════════════════════════════════════════════════════════════════════════════


-- ── 1. deal_stages ───────────────────────────────────────────────────────────
-- Creators do not all work the same way. Some script and shoot on the same day,
-- some run a client-review round, some do three edit passes. Four fixed columns
-- on `deals` cannot express any of that, so stages become rows.
--
-- `done` and `done_at` are separate on purpose. The backfill below knows from a
-- deal's status WHICH stages are finished, but has no idea WHEN they finished.
-- Recording the fact without inventing a timestamp is the honest option;
-- writing now() into every historical stage would be fabricated data that looks
-- exactly like the real thing.

create table if not exists deal_stages (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  deal_id      uuid        not null references deals(id) on delete cascade,
  name         text        not null,
  sort_order   integer     not null default 0,
  due_date     date,
  done         boolean     not null default false,
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint deal_stages_name_not_blank check (btrim(name) <> ''),
  -- A stage cannot carry a completion time without being complete.
  constraint deal_stages_done_at_implies_done check (done_at is null or done)
);

-- Deliberately not unique on (deal_id, sort_order): reordering stages would
-- otherwise need every row rewritten in a specific sequence to avoid transient
-- collisions mid-update.
create index if not exists deal_stages_deal_idx      on deal_stages (deal_id, sort_order);
create index if not exists deal_stages_workspace_idx on deal_stages (workspace_id);

alter table deal_stages enable row level security;
alter table deal_stages force  row level security;

drop policy if exists "deal_stages: workspace members" on deal_stages;
create policy "deal_stages: workspace members" on deal_stages for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

drop trigger if exists deal_stages_updated_at on deal_stages;
create trigger deal_stages_updated_at
  before update on deal_stages
  for each row execute function set_updated_at();


-- ── 2. Backfill stages from the four fixed columns ───────────────────────────
-- Every existing deal gets the four defaults so its timeline renders exactly as
-- it does today, including stages that never had a date (those still read as
-- "skipped", which is what the current UI shows).
--
-- The status → completed-count mapping mirrors STAGE_INDEX in
-- components/deal/TimelineCard.tsx. Published, payment_awaited and paid all sit
-- past the last stage, so all four count as done.

insert into deal_stages (workspace_id, deal_id, name, sort_order, due_date, done)
select
  d.workspace_id,
  d.id,
  s.name,
  s.sort_order,
  case s.sort_order
    when 0 then d.script_due_date
    when 1 then d.shoot_date
    when 2 then d.edit_done_date
    else        d.publish_date
  end,
  s.sort_order < case d.status
                   when 'intake'     then 0
                   when 'script_due' then 0
                   when 'shooting'   then 1
                   when 'editing'    then 2
                   else                   4
                 end
from deals d
cross join (values
  ('Script',  0),
  ('Shoot',   1),
  ('Edit',    2),
  ('Publish', 3)
) as s(name, sort_order)
where not exists (select 1 from deal_stages ds where ds.deal_id = d.id);


-- ── 3. brand_contacts ────────────────────────────────────────────────────────
-- Agency contacts change constantly, and a deal chased at the wrong person is a
-- deal that does not get paid. One row per contact, with one marked primary for
-- the WhatsApp nudges to default to.

create table if not exists brand_contacts (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  brand_id     uuid        not null references brands(id) on delete cascade,
  name         text        not null default '',
  phone        text,
  email        text,
  role         text,
  is_primary   boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists brand_contacts_brand_idx     on brand_contacts (brand_id);
create index if not exists brand_contacts_workspace_idx on brand_contacts (workspace_id);

-- At most one primary per brand, enforced rather than left to the UI. A partial
-- unique index is the right shape here: it constrains only the rows where
-- is_primary is true and leaves every other contact unconstrained.
create unique index if not exists brand_contacts_one_primary
  on brand_contacts (brand_id) where is_primary;

alter table brand_contacts enable row level security;
alter table brand_contacts force  row level security;

drop policy if exists "brand_contacts: workspace members" on brand_contacts;
create policy "brand_contacts: workspace members" on brand_contacts for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

drop trigger if exists brand_contacts_updated_at on brand_contacts;
create trigger brand_contacts_updated_at
  before update on brand_contacts
  for each row execute function set_updated_at();


-- ── 4. Backfill contacts from the brand columns ──────────────────────────────
-- Only brands that actually have contact details get a row. Creating an empty
-- "Primary contact" for a brand that never had one would be inventing data.

insert into brand_contacts (workspace_id, brand_id, name, phone, email, is_primary)
select
  b.workspace_id,
  b.id,
  coalesce(nullif(btrim(b.contact_person), ''), ''),
  nullif(btrim(b.contact_phone), ''),
  nullif(btrim(b.contact_email), ''),
  true
from brands b
where (
       nullif(btrim(coalesce(b.contact_person, '')), '') is not null
    or nullif(btrim(coalesce(b.contact_phone,  '')), '') is not null
    or nullif(btrim(coalesce(b.contact_email,  '')), '') is not null
  )
  and not exists (select 1 from brand_contacts bc where bc.brand_id = b.id);


-- ── 5. payments: advances, part-payments and TDS ─────────────────────────────
-- The UNIQUE on deal_id stays until 020 (see the header). These columns are all
-- optional, so existing rows and existing inserts are unaffected.
--
-- amount_received is separate from amount because they genuinely differ: a
-- brand invoiced ₹1,00,000 who withholds ₹10,000 TDS pays ₹90,000, and both
-- numbers are needed: the gross for tax, the net for the bank reconciliation.
-- Leaving it null means "not recorded yet", which is not the same as zero.

alter table payments add column if not exists amount_received integer;
alter table payments add column if not exists tds_amount      integer not null default 0;
alter table payments add column if not exists label           text;
alter table payments add column if not exists sort_order      integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_amount_received_non_negative'
  ) then
    alter table payments add constraint payments_amount_received_non_negative
      check (amount_received is null or amount_received >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_tds_non_negative'
  ) then
    alter table payments add constraint payments_tds_non_negative
      check (tds_amount >= 0);
  end if;
end $$;


-- ── 6. deals: on hold, and foreign currency ──────────────────────────────────
-- on_hold is a flag rather than a status. A held deal keeps whatever stage it
-- reached; it just stops counting as expected income until it is un-held. Made
-- a flag precisely so un-holding does not have to guess where it was.
--
-- Currency: `rate` remains the INR figure, always. Every existing query, report
-- and total keeps working untouched, and tax reporting has to be in INR
-- regardless. A foreign deal additionally records what was actually agreed
-- (rate_original) and the rate it was converted at (fx_rate), snapshotted at
-- entry, because last year's dollar deal must not silently revalue at today's rate.

alter table deals add column if not exists on_hold       boolean not null default false;
alter table deals add column if not exists on_hold_at    timestamptz;
alter table deals add column if not exists currency      char(3) not null default 'INR';
alter table deals add column if not exists rate_original integer;
alter table deals add column if not exists fx_rate       numeric(12,6);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deals_on_hold_at_implies_on_hold'
  ) then
    alter table deals add constraint deals_on_hold_at_implies_on_hold
      check (on_hold_at is null or on_hold);
  end if;

  -- A non-INR deal without its original amount and conversion rate is a deal
  -- whose real value has been lost. Refuse to store one.
  if not exists (
    select 1 from pg_constraint where conname = 'deals_foreign_currency_complete'
  ) then
    alter table deals add constraint deals_foreign_currency_complete
      check (
        currency = 'INR'
        or (rate_original is not null and fx_rate is not null and fx_rate > 0)
      );
  end if;
end $$;


-- ── 7. Verification ──────────────────────────────────────────────────────────
-- Raising here rolls the entire migration back, which is the desired behaviour:
-- a half-applied schema is worse than an unapplied one.

do $$
declare
  deals_total     bigint;
  deals_staged    bigint;
  stages_total    bigint;
  contacts_total  bigint;
  orphan_stages   bigint;
  unforced        text;
begin
  select count(*) into deals_total  from deals;
  select count(distinct deal_id) into deals_staged from deal_stages;
  select count(*) into stages_total from deal_stages;
  select count(*) into contacts_total from brand_contacts;

  if deals_total <> deals_staged then
    raise exception
      'Stage backfill incomplete: % deal(s) exist but only % have stages.',
      deals_total, deals_staged;
  end if;

  -- Every stage must inherit its deal's workspace, or RLS would hide rows from
  -- the very workspace that owns them.
  select count(*) into orphan_stages
  from deal_stages ds join deals d on d.id = ds.deal_id
  where ds.workspace_id <> d.workspace_id;

  if orphan_stages > 0 then
    raise exception 'Workspace mismatch on % stage row(s).', orphan_stages;
  end if;

  select string_agg(c.relname, ', ') into unforced
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('deal_stages', 'brand_contacts')
    and (c.relrowsecurity = false or c.relforcerowsecurity = false);

  if unforced is not null then
    raise exception 'RLS not enabled+forced on: %', unforced;
  end if;

  raise notice 'OK. % deals carry % stages; % brand contact(s) backfilled.',
    deals_total, stages_total, contacts_total;
  raise notice 'payments.deal_id UNIQUE is intentionally still in place; 020 removes it.';
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DOWN SCRIPT. Paste and run to revert. Safe: 019 added only, so nothing that
-- existed before it is touched.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- drop table if exists deal_stages;
-- drop table if exists brand_contacts;
--
-- alter table payments drop constraint if exists payments_amount_received_non_negative;
-- alter table payments drop constraint if exists payments_tds_non_negative;
-- alter table payments drop column if exists amount_received;
-- alter table payments drop column if exists tds_amount;
-- alter table payments drop column if exists label;
-- alter table payments drop column if exists sort_order;
--
-- alter table deals drop constraint if exists deals_on_hold_at_implies_on_hold;
-- alter table deals drop constraint if exists deals_foreign_currency_complete;
-- alter table deals drop column if exists on_hold;
-- alter table deals drop column if exists on_hold_at;
-- alter table deals drop column if exists currency;
-- alter table deals drop column if exists rate_original;
-- alter table deals drop column if exists fx_rate;
