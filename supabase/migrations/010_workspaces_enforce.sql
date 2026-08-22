-- ─────────────────────────────────────────────────────────────────────────────
-- Blubanana: Phase 2, stage 2 of 3: workspaces (MIGRATE / ENFORCE).
-- Run this once in the Supabase dashboard SQL editor, after 009 has been
-- applied AND its verification block reported zero orphans.
--
-- This is the migration that actually moves tenant isolation from
-- "creator_id = auth.uid()" to workspace membership. It:
--
--   1. makes workspace_id NOT NULL on all seven business tables
--   2. replaces every creator_id RLS policy with a workspace-membership one
--   3. turns on FORCE ROW LEVEL SECURITY on those tables
--   4. re-scopes the attachments storage policy to workspace membership
--
-- creator_id columns are NOT dropped here. They stay as a safety net until 011,
-- so this migration is reversible: the down script at the bottom restores the
-- previous policies exactly.
--
-- Safe to re-run.
--
--
-- WHY FORCE RLS IS APPLIED TO BUSINESS TABLES BUT NOT IDENTITY TABLES
--
-- The architecture spec says to FORCE row level security everywhere. That is
-- correct for its assumed design: a Node API connecting as a non-owner role.
-- Applied literally here it would break account creation, and it is worth being
-- explicit about why rather than quietly skipping it.
--
-- FORCE makes policies apply to the table OWNER as well. In Supabase the app
-- connects as `authenticated`, which owns nothing, so RLS already applies to it
-- with or without FORCE. What FORCE additionally constrains is the `postgres`
-- role, and therefore every SECURITY DEFINER function owned by it.
--
-- `handle_new_user()` is exactly such a function: it fires on auth.users insert
-- and writes profiles, workspaces and memberships. In that context auth.uid()
-- is not the new user, so a forced policy of `auth.uid() = id` would reject the
-- insert and signup would fail. The `public_creator_profiles` view depends on
-- the same owner-bypass to serve the public profile card to anonymous visitors.
--
-- So: FORCE on the seven business tables, where it is pure upside and defends
-- against a future careless SECURITY DEFINER function. ENABLE without FORCE on
-- profiles/workspaces/memberships, where the owner bypass is load-bearing.
-- Isolation for the app is identical either way; `authenticated` is never an
-- owner, so it is always subject to policy.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Preconditions ────────────────────────────────────────────────────────────

do $$
declare orphans integer;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workspaces'
  ) then
    raise exception 'Migration 009 has not been applied. Run 009_workspaces_expand.sql first.';
  end if;

  select
    (select count(*) from brands             where workspace_id is null)
  + (select count(*) from deals              where workspace_id is null)
  + (select count(*) from payments           where workspace_id is null)
  + (select count(*) from deal_deliverables  where workspace_id is null)
  + (select count(*) from brand_ratings      where workspace_id is null)
  + (select count(*) from invoices           where workspace_id is null)
  + (select count(*) from invoice_line_items where workspace_id is null)
  into orphans;

  if orphans > 0 then
    raise exception
      'Refusing to enforce: % row(s) still have a null workspace_id. Re-run 009 first.', orphans;
  end if;
end $$;


-- ── 1. workspace_id becomes mandatory ────────────────────────────────────────

alter table brands             alter column workspace_id set not null;
alter table deals              alter column workspace_id set not null;
alter table payments           alter column workspace_id set not null;
alter table deal_deliverables  alter column workspace_id set not null;
alter table brand_ratings      alter column workspace_id set not null;
alter table invoices           alter column workspace_id set not null;
alter table invoice_line_items alter column workspace_id set not null;


-- ── 2. Policies move from creator_id to workspace membership ─────────────────
-- Every policy carries WITH CHECK as well as USING. Without WITH CHECK a member
-- could read only their own rows but still INSERT a row into someone else's
-- workspace, which is a write-side leak that is easy to miss.
--
-- `in (select auth_workspace_ids())` rather than a correlated EXISTS: the
-- function is STABLE, so Postgres evaluates it once per query as an InitPlan
-- instead of once per row.

-- brands
drop policy if exists "Creators manage own brands" on brands;
drop policy if exists "brands: own rows" on brands;
drop policy if exists "brands: workspace members" on brands;
create policy "brands: workspace members" on brands for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

-- deals
drop policy if exists "Creators manage own deals" on deals;
drop policy if exists "deals: own rows" on deals;
drop policy if exists "deals: workspace members" on deals;
create policy "deals: workspace members" on deals for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

-- payments: previously scoped through a subquery on deals; now direct, which
-- also removes a per-row join from every payment read.
drop policy if exists "payments: own deals only" on payments;
drop policy if exists "payments: via deal" on payments;
drop policy if exists "payments: workspace members" on payments;
create policy "payments: workspace members" on payments for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

-- deal_deliverables
drop policy if exists "Creators manage own deliverables" on deal_deliverables;
drop policy if exists "deal_deliverables: workspace members" on deal_deliverables;
create policy "deal_deliverables: workspace members" on deal_deliverables for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

-- brand_ratings
drop policy if exists "brand_ratings: own rows" on brand_ratings;
drop policy if exists "brand_ratings: workspace members" on brand_ratings;
create policy "brand_ratings: workspace members" on brand_ratings for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

-- invoices
drop policy if exists "invoices: own rows" on invoices;
drop policy if exists "invoices: workspace members" on invoices;
create policy "invoices: workspace members" on invoices for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

-- invoice_line_items
drop policy if exists "invoice_line_items: own rows" on invoice_line_items;
drop policy if exists "invoice_line_items: workspace members" on invoice_line_items;
create policy "invoice_line_items: workspace members" on invoice_line_items for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));


-- ── 3. FORCE row level security on the business tables ───────────────────────
-- See the header for why identity tables are deliberately excluded.

alter table brands             enable row level security;
alter table brands             force  row level security;
alter table deals              enable row level security;
alter table deals              force  row level security;
alter table payments           enable row level security;
alter table payments           force  row level security;
alter table deal_deliverables  enable row level security;
alter table deal_deliverables  force  row level security;
alter table brand_ratings      enable row level security;
alter table brand_ratings      force  row level security;
alter table invoices           enable row level security;
alter table invoices           force  row level security;
alter table invoice_line_items enable row level security;
alter table invoice_line_items force  row level security;


-- ── 4. Membership writes ─────────────────────────────────────────────────────
-- Read access came in 009. Writes are owner-only, so a member cannot promote
-- themselves or add someone to a workspace they merely belong to.

drop policy if exists "memberships: owner manages" on memberships;
create policy "memberships: owner manages"
  on memberships for all
  using (exists (
    select 1 from memberships owner_row
    where owner_row.workspace_id = memberships.workspace_id
      and owner_row.user_id = auth.uid()
      and owner_row.role = 'owner'
      and owner_row.status = 'active'
  ))
  with check (exists (
    select 1 from memberships owner_row
    where owner_row.workspace_id = memberships.workspace_id
      and owner_row.user_id = auth.uid()
      and owner_row.role = 'owner'
      and owner_row.status = 'active'
  ));


-- ── 5. Attachment storage follows the workspace ──────────────────────────────
-- Object keys are `{workspace_id}/{deal_id}/{filename}`. Because 009 gave each
-- workspace the creator's own uuid, existing paths keep resolving unchanged.
--
-- The folder segment is compared as text against the member's workspaces rather
-- than cast to uuid: an object with a non-uuid first segment would make a cast
-- throw, and a storage policy that errors is a storage policy that denies
-- everything.

drop policy if exists "attachments: own folder only" on storage.objects;
drop policy if exists "attachments: workspace members" on storage.objects;
create policy "attachments: workspace members"
  on storage.objects for all
  using (
    bucket_id = 'attachments'
    and exists (
      select 1 from memberships m
      where m.user_id = auth.uid()
        and m.status = 'active'
        and m.workspace_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'attachments'
    and exists (
      select 1 from memberships m
      where m.user_id = auth.uid()
        and m.status = 'active'
        and m.workspace_id::text = (storage.foldername(name))[1]
    )
  );


-- ── Verification ─────────────────────────────────────────────────────────────

do $$
declare
  unforced text;
begin
  select string_agg(c.relname, ', ')
    into unforced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in ('brands','deals','payments','deal_deliverables',
                       'brand_ratings','invoices','invoice_line_items')
     and (c.relrowsecurity = false or c.relforcerowsecurity = false);

  if unforced is not null then
    raise exception 'RLS not enabled+forced on: %', unforced;
  end if;

  raise notice 'Workspace isolation enforced on 7 business tables.';
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- DOWN SCRIPT: paste and run this to revert to creator_id isolation.
-- creator_id is still populated on every table until 011, so this is a complete
-- rollback, not a partial one.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- alter table brands             no force row level security;
-- alter table deals              no force row level security;
-- alter table payments           no force row level security;
-- alter table deal_deliverables  no force row level security;
-- alter table brand_ratings      no force row level security;
-- alter table invoices           no force row level security;
-- alter table invoice_line_items no force row level security;
--
-- alter table brands             alter column workspace_id drop not null;
-- alter table deals              alter column workspace_id drop not null;
-- alter table payments           alter column workspace_id drop not null;
-- alter table deal_deliverables  alter column workspace_id drop not null;
-- alter table brand_ratings      alter column workspace_id drop not null;
-- alter table invoices           alter column workspace_id drop not null;
-- alter table invoice_line_items alter column workspace_id drop not null;
--
-- drop policy if exists "brands: workspace members" on brands;
-- drop policy if exists "deals: workspace members" on deals;
-- drop policy if exists "payments: workspace members" on payments;
-- drop policy if exists "deal_deliverables: workspace members" on deal_deliverables;
-- drop policy if exists "brand_ratings: workspace members" on brand_ratings;
-- drop policy if exists "invoices: workspace members" on invoices;
-- drop policy if exists "invoice_line_items: workspace members" on invoice_line_items;
--
-- create policy "brands: own rows"            on brands for all using (auth.uid() = creator_id);
-- create policy "deals: own rows"             on deals for all using (auth.uid() = creator_id);
-- create policy "Creators manage own deliverables" on deal_deliverables for all using (auth.uid() = creator_id);
-- create policy "brand_ratings: own rows"     on brand_ratings for all using (auth.uid() = creator_id);
-- create policy "invoices: own rows"          on invoices for all using (auth.uid() = creator_id);
-- create policy "invoice_line_items: own rows" on invoice_line_items for all using (auth.uid() = creator_id);
-- create policy "payments: own deals only" on payments for all using (
--   exists (select 1 from deals where deals.id = payments.deal_id and deals.creator_id = auth.uid()));
--
-- drop policy if exists "attachments: workspace members" on storage.objects;
-- create policy "attachments: own folder only" on storage.objects for all
--   using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
