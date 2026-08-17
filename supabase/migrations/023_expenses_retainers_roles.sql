-- ═════════════════════════════════════════════════════════════════════════════
-- 023: expenses, retainers, and per-area manager access
--
-- Run AFTER 022. Purely additive: nothing is dropped and no shape changes, so
-- the running app is unaffected until the build that uses these ships.
-- ═════════════════════════════════════════════════════════════════════════════


-- ── 1. Expenses ──────────────────────────────────────────────────────────────
-- Turns "turnover" into "taxable income", which is what makes the annual
-- report actually tax-ready. Editor fees, a cameraman, equipment, travel.
--
-- Deliberately not linked to a deal. Most creator costs are not attributable to
-- one collaboration (a camera, a monthly editor retainer), and forcing a deal
-- would either block the entry or invite a wrong one.

create table if not exists expenses (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  spent_on     date        not null,
  amount       integer     not null check (amount >= 0),  -- whole INR rupees
  category     text        not null default 'other',
  note         text,
  -- Optional link, for a cost that genuinely belongs to one job.
  deal_id      uuid        references deals(id) on delete set null,
  -- Storage path in the existing attachments bucket, for a receipt image.
  receipt_path text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists expenses_workspace_date_idx on expenses (workspace_id, spent_on desc);

alter table expenses enable row level security;
alter table expenses force  row level security;

drop policy if exists "expenses: workspace members" on expenses;
create policy "expenses: workspace members" on expenses for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

drop trigger if exists expenses_updated_at on expenses;
create trigger expenses_updated_at
  before update on expenses
  for each row execute function set_updated_at();


-- ── 2. Retainers ─────────────────────────────────────────────────────────────
-- A toggle on the deal, like ad rights. Many brands sign six or twelve month
-- retainers with a monthly deliverable count, and logging twelve near-identical
-- deals by hand is exactly the drudgery this product exists to remove.
--
-- The generated deals are ordinary deals pointing back at the parent, so every
-- existing screen, total and reminder works on them with no special casing.

alter table deals add column if not exists is_retainer            boolean not null default false;
alter table deals add column if not exists retainer_months        integer;
alter table deals add column if not exists retainer_per_period    integer;  -- deliverables per month
alter table deals add column if not exists retainer_parent_id     uuid references deals(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deals_retainer_complete') then
    alter table deals add constraint deals_retainer_complete
      check (
        not is_retainer
        or (retainer_months is not null and retainer_months > 0
            and retainer_per_period is not null and retainer_per_period > 0)
      );
  end if;

  -- A generated deal cannot itself be a retainer parent; that would be a cycle
  -- and would generate deals forever.
  if not exists (select 1 from pg_constraint where conname = 'deals_retainer_not_nested') then
    alter table deals add constraint deals_retainer_not_nested
      check (retainer_parent_id is null or not is_retainer);
  end if;
end $$;

create index if not exists deals_retainer_parent_idx on deals (retainer_parent_id);


-- ── 3. Per-area manager access ───────────────────────────────────────────────
-- A creator invites a manager and chooses, per area, what they can see. A
-- fully-trusted manager gets everything switched on; a production assistant
-- gets deals and deadlines with every amount masked.
--
-- Defaults are the cautious set: the work, not the money. An invite that
-- silently granted bank details would be the wrong way round.

alter table memberships add column if not exists can_see_deals     boolean not null default true;
alter table memberships add column if not exists can_see_brands    boolean not null default true;
alter table memberships add column if not exists can_see_rates     boolean not null default false;
alter table memberships add column if not exists can_see_invoices  boolean not null default false;
alter table memberships add column if not exists can_see_money     boolean not null default false;
alter table memberships add column if not exists can_see_expenses  boolean not null default false;
alter table memberships add column if not exists can_see_banking   boolean not null default false;


-- ── 4. Only the owner deletes ────────────────────────────────────────────────
-- Enforced in the database, not the UI, so it holds against a direct API call.
-- A manager can be granted every read there is and still cannot destroy
-- anything: deletion is the one action with no undo.

do $$
declare
  target text;
begin
  foreach target in array array['deals', 'payments', 'invoices', 'brands', 'deal_stages',
                                'brand_contacts', 'expenses', 'deal_deliverables']
  loop
    execute format('drop policy if exists %I on %I', target || ': owner deletes only', target);
    execute format(
      'create policy %I on %I for delete using (workspace_id in (select auth_owned_workspace_ids()))',
      target || ': owner deletes only', target
    );
  end loop;
end $$;


-- ── 5. Verification ──────────────────────────────────────────────────────────

do $$
declare
  missing text;
begin
  select string_agg(t, ', ') into missing
  from unnest(array['deals','payments','invoices','brands','deal_stages',
                    'brand_contacts','expenses','deal_deliverables']) as t
  where not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = t and cmd = 'DELETE'
  );

  if missing is not null then
    raise exception 'Delete policy missing on: %', missing;
  end if;

  raise notice 'OK. Expenses, retainers and per-area manager access are in place.';
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DOWN SCRIPT
-- ═════════════════════════════════════════════════════════════════════════════
--
-- drop table if exists expenses;
-- alter table deals drop constraint if exists deals_retainer_complete;
-- alter table deals drop constraint if exists deals_retainer_not_nested;
-- alter table deals drop column if exists is_retainer;
-- alter table deals drop column if exists retainer_months;
-- alter table deals drop column if exists retainer_per_period;
-- alter table deals drop column if exists retainer_parent_id;
-- alter table memberships drop column if exists can_see_deals;
-- alter table memberships drop column if exists can_see_brands;
-- alter table memberships drop column if exists can_see_rates;
-- alter table memberships drop column if exists can_see_invoices;
-- alter table memberships drop column if exists can_see_money;
-- alter table memberships drop column if exists can_see_expenses;
-- alter table memberships drop column if exists can_see_banking;
